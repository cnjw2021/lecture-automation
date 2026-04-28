/**
 * PlaywrightSyncSimulator
 *
 * `sync-playwright` 가 wait ms 를 재분배한 결과로 각 action 이 몇 ms 시점에 발화하는지 사전에 시뮬레이션한다.
 * webm 재녹화·Lambda 렌더 없이 syncPoint 의 적절성을 0.5 초 안에 판정할 수 있도록 한다.
 *
 * 알고리즘은 SyncPlaywrightUseCase 와 동일:
 *   1. syncPoint phrase 의 narration 내 시각 산출 (char-count 추산 또는 alignment 기반)
 *   2. syncPoints 로 actions 를 segment 분할
 *   3. 각 segment 의 wait 들에 비례 배분
 *   4. action[0] 부터 누적해 각 action 의 시작 시각 계산
 *
 * SyncPlaywrightUseCase 는 file IO (WAV/alignment.json) 를 포함하므로 본 모듈은 pure 한 계산만 담당하고,
 * 호출자가 phraseTimings 를 사전 주입하는 형태로 alignment-based 정확도를 옵션으로 지원한다.
 */

import { Scene, PlaywrightVisual, PlaywrightAction, PlaywrightSyncPoint } from '../entities/Lecture';
import { isForwardSyncTarget, isIsolatedLiveDemoScene } from '../policies/LiveDemoScenePolicy';
import { estimateFixedActionDurationMs, estimatePlaywrightActionDurationMs } from './ActionTiming';

export type TimingMethod = 'char-count' | 'alignment' | 'wav-analysis';

export interface SimulatedAction {
  index: number;
  cmd: string;
  /** 누적된 시작 시각 (ms) */
  startMs: number;
  /** 본 action 이 차지하는 길이 (ms). offscreen 이면 0. */
  durationMs: number;
  isWait: boolean;
  isOffscreen: boolean;
  /** 시작 시각 부근의 narration 발췌 (drift 판정용) */
  narrationContext: string;
  /** action 의 학습 주제 — 본 시점에 narration 에서 언급되어야 할 키워드 (type 의 key, prefill 의 html 등) */
  topic?: string;
  /** drift 의심: action 의 topic 키워드가 narration 에서 더 일찍 언급된다면 그 시각 (ms) */
  topicMentionedAtMs?: number;
  /** drift 의심: 위 시각과 startMs 의 차이 (ms). 양수일수록 action 이 narration 보다 늦음 */
  topicDriftMs?: number;
}

export interface SceneSimulationResult {
  sceneId: number;
  totalDurationMs: number;
  timingMethod: TimingMethod;
  narration: string;
  syncPoints: PlaywrightSyncPoint[];
  actions: SimulatedAction[];
  /** 실행 중 발견된 경고 (wait 부재, 음수 budget, fixed > target 등) */
  warnings: string[];
  /** 본 씬이 simulator 에 의해 처리될 수 있었는지 (forward-sync 대상 여부 등) */
  applicable: boolean;
  skipReason?: string;
}

export interface SimulationOptions {
  /** actionIndex → phrase 시작 ms. 미주입 시 char-count 기반 추산 */
  phraseTimings?: Map<number, number>;
  /** 외부에서 결정된 timing method (alignment 기반인지 char-count 인지 등) */
  timingMethodHint?: TimingMethod;
  /** 명시적 totalDurationMs (alignment 기반일 때 wav 길이 등). 미주입 시 scene.durationSec 또는 char count 추정 */
  totalMsOverride?: number;
}

/**
 * 단일 Scene 의 sync 결과를 시뮬레이션한다.
 */
export function simulateSceneSync(scene: Scene, options: SimulationOptions = {}): SceneSimulationResult {
  const sceneId = scene.scene_id;

  if (scene.visual.type !== 'playwright') {
    return emptyResult(sceneId, scene.narration, 0, 'char-count', false, 'Playwright 씬 아님');
  }
  if (isIsolatedLiveDemoScene(scene)) {
    return emptyResult(
      sceneId,
      scene.narration,
      (scene.durationSec ?? 0) * 1000,
      'char-count',
      false,
      'isolated 라이브 데모 (역방향 싱크 대상)',
    );
  }
  if (!isForwardSyncTarget(scene)) {
    return emptyResult(
      sceneId,
      scene.narration,
      (scene.durationSec ?? 0) * 1000,
      'char-count',
      false,
      '순방향 싱크 대상 아님',
    );
  }

  const visual = scene.visual as PlaywrightVisual;
  const actions = visual.action;
  const syncPoints = visual.syncPoints ?? [];
  const totalMs = options.totalMsOverride ?? estimateTotalMs(scene);
  const timingMethod = options.timingMethodHint ?? 'char-count';
  const warnings: string[] = [];

  const sortedSyncPoints = [...syncPoints].sort((a, b) => a.actionIndex - b.actionIndex);

  // 1. phrase 시각 결정
  const phraseTimings = new Map<number, number>(options.phraseTimings ?? []);
  for (const sp of sortedSyncPoints) {
    if (!phraseTimings.has(sp.actionIndex)) {
      phraseTimings.set(sp.actionIndex, charCountEstimate(sp.phrase, scene.narration, totalMs));
    }
  }

  // 2. 새 wait ms 계산 (segment 별)
  const segments = buildSegments(sortedSyncPoints, actions.length);
  const newWaits = new Map<number, number>();

  for (let si = 0; si < segments.length; si++) {
    const { from, to } = segments[si];
    if (from === to) continue;
    const segStartMs = si === 0 ? 0 : phraseTimings.get(sortedSyncPoints[si - 1].actionIndex) ?? 0;
    const segEndMs =
      si < sortedSyncPoints.length ? phraseTimings.get(sortedSyncPoints[si].actionIndex) ?? totalMs : totalMs;
    const targetSegDurationMs = segEndMs - segStartMs;

    const waitIndices: number[] = [];
    let fixedMs = 0;
    for (let j = from; j < to; j++) {
      if (actions[j].offscreen) continue;
      if (actions[j].cmd === 'wait') waitIndices.push(j);
      else fixedMs += estimateFixedActionDurationMs(actions[j]).ms;
    }

    if (waitIndices.length === 0) {
      if (targetSegDurationMs > 0) {
        warnings.push(`세그먼트 ${si} (actions ${from}~${to - 1}): wait 액션 없음, 조정 불가`);
      }
      continue;
    }

    if (fixedMs > targetSegDurationMs) {
      warnings.push(
        `세그먼트 ${si} (actions ${from}~${to - 1}): 고정 액션 ${fixedMs}ms 가 목표 ${targetSegDurationMs}ms 초과 — ` +
          `구조적 sync 불가 (narration/syncPoint/action 분할 조정 필요)`,
      );
    }

    const availableMs = Math.max(0, targetSegDurationMs - fixedMs);
    const currentWaitTotal = waitIndices.reduce((sum, idx) => sum + getNonNegativeWaitMs(actions[idx]), 0);

    for (const idx of waitIndices) {
      const original = getNonNegativeWaitMs(actions[idx]);
      const ratio = currentWaitTotal > 0 ? original / currentWaitTotal : 1 / waitIndices.length;
      newWaits.set(idx, Math.max(0, Math.round(availableMs * ratio)));
    }
  }

  // 3. 누적 시작 시각 계산
  const simulated: SimulatedAction[] = [];
  let cursor = 0;
  for (let i = 0; i < actions.length; i++) {
    const a = actions[i];
    const start = cursor;
    let dur: number;
    if (a.offscreen) {
      dur = 0;
    } else if (a.cmd === 'wait') {
      dur = newWaits.has(i) ? newWaits.get(i)! : getNonNegativeWaitMs(a);
    } else {
      dur = estimatePlaywrightActionDurationMs(a).ms;
    }

    const topic = extractTopic(a);
    const narrationContext = extractNarrationContext(scene.narration, start, totalMs);

    let topicMentionedAtMs: number | undefined;
    let topicDriftMs: number | undefined;
    if (topic) {
      const mentionMs = findTopicMentionMs(topic, scene.narration, totalMs);
      if (mentionMs !== undefined) {
        topicMentionedAtMs = mentionMs;
        topicDriftMs = start - mentionMs;
      }
    }

    simulated.push({
      index: i,
      cmd: a.cmd,
      startMs: start,
      durationMs: dur,
      isWait: a.cmd === 'wait',
      isOffscreen: !!a.offscreen,
      narrationContext,
      topic,
      topicMentionedAtMs,
      topicDriftMs,
    });
    cursor = start + dur;
  }

  return {
    sceneId,
    totalDurationMs: totalMs,
    timingMethod,
    narration: scene.narration,
    syncPoints,
    actions: simulated,
    warnings,
    applicable: true,
  };
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function emptyResult(
  sceneId: number,
  narration: string,
  totalMs: number,
  timingMethod: TimingMethod,
  applicable: boolean,
  skipReason?: string,
): SceneSimulationResult {
  return {
    sceneId,
    totalDurationMs: totalMs,
    timingMethod,
    narration,
    syncPoints: [],
    actions: [],
    warnings: [],
    applicable,
    skipReason,
  };
}

function estimateTotalMs(scene: Scene): number {
  if (typeof scene.durationSec === 'number' && scene.durationSec > 0) {
    return scene.durationSec * 1000;
  }
  // SSoT: 1 초 ≒ 5.5 자 (일본어)
  return Math.ceil(scene.narration.length / 5.5) * 1000;
}

function getNonNegativeWaitMs(action: PlaywrightAction): number {
  const ms = action.ms ?? 0;
  return Number.isFinite(ms) && ms > 0 ? ms : 0;
}

function buildSegments(
  sortedSyncPoints: PlaywrightSyncPoint[],
  totalActions: number,
): { from: number; to: number }[] {
  const segments: { from: number; to: number }[] = [];
  let from = 0;
  for (const sp of sortedSyncPoints) {
    segments.push({ from, to: sp.actionIndex });
    from = sp.actionIndex;
  }
  segments.push({ from, to: totalActions });
  return segments;
}

function charCountEstimate(phrase: string, narration: string, totalMs: number): number {
  const pos = narration.indexOf(phrase);
  if (pos === -1) return 0;
  return Math.round((pos / narration.length) * totalMs);
}

/**
 * action 의 학습 주제(topic)를 추출한다. drift 판정에 사용.
 *  - type/prefill_codepen 처럼 콘텐츠가 명확한 경우만 의미 있는 값을 반환
 *  - mouse_move/click 등 시각 효과 위주 액션은 topic 미정으로 둠
 */
function extractTopic(action: PlaywrightAction): string | undefined {
  if (action.cmd === 'type' && typeof action.key === 'string' && action.key.length > 0) {
    return action.key;
  }
  // prefill_codepen 은 별도 브랜치에서 추가되는 cmd. 정의 여부에 무관하게 동작하도록 any 캐스트로 접근.
  const anyAction = action as any;
  if (anyAction.cmd === 'prefill_codepen' && typeof anyAction.html === 'string' && anyAction.html.length > 0) {
    return anyAction.html;
  }
  if (action.cmd === 'highlight' && typeof action.note === 'string') {
    return action.note;
  }
  return undefined;
}

/**
 * topic 키워드가 narration 에서 처음 언급되는 시점을 추정한다.
 *  - 본 함수는 best-effort. HTML 태그 등 noise 가 많은 topic 은 의미 없는 매칭이 될 수 있어 후보를 신중하게 선별.
 *  - "<img" 같은 태그 시작 토큰, 한글/일본어 키워드만 매칭 시도
 */
function findTopicMentionMs(topic: string, narration: string, totalMs: number): number | undefined {
  const candidates = extractMentionableTokens(topic);
  let earliestPos: number | undefined;
  for (const token of candidates) {
    const pos = narration.indexOf(token);
    if (pos === -1) continue;
    if (earliestPos === undefined || pos < earliestPos) earliestPos = pos;
  }
  if (earliestPos === undefined) return undefined;
  return Math.round((earliestPos / narration.length) * totalMs);
}

/**
 * topic 문자열에서 narration 에 언급될 가능성이 있는 키워드 토큰을 추출한다.
 *  - HTML 태그 이름 (예: img, a, p)
 *  - alt/href 속성 값 등 인용된 문자열
 *  - 일본어/카타카나 단어
 */
function extractMentionableTokens(topic: string): string[] {
  const tokens = new Set<string>();
  // 1. HTML 태그 이름
  const tagRe = /<\/?([a-zA-Z][a-zA-Z0-9]*)/g;
  let m: RegExpExecArray | null;
  while ((m = tagRe.exec(topic)) !== null) {
    const name = m[1];
    if (!name) continue;
    // 너무 짧은 태그 (a, p) 는 narration 에 우연 매칭 가능성이 높아 제외 — 명시적 일본어 매칭이 필요한 케이스
    if (name.length >= 3) tokens.add(name);
    // 자주 쓰는 짧은 태그는 가타카나 형태로도 시도
    if (name === 'img') {
      tokens.add('イメージ');
      tokens.add('画像');
    }
    if (name === 'a') {
      tokens.add('リンク');
    }
  }
  // 2. 따옴표 안 문자열 (alt, href 등)
  const quoteRe = /"([^"]+)"/g;
  while ((m = quoteRe.exec(topic)) !== null) {
    const value = m[1];
    if (!value) continue;
    if (/^https?:/.test(value)) continue; // URL 은 narration 에 그대로 안 나옴
    if (value.length >= 2 && value.length <= 24) tokens.add(value);
  }
  // 3. 일본어/카타카나/한자 토큰
  const jpRe = /[぀-ゟ゠-ヿ一-龯]{2,}/g;
  while ((m = jpRe.exec(topic)) !== null) {
    if (m[0].length >= 2) tokens.add(m[0]);
  }
  return Array.from(tokens);
}

/**
 * 특정 ms 시점 부근의 narration 발췌를 반환한다 (가독용).
 */
function extractNarrationContext(narration: string, ms: number, totalMs: number): string {
  if (totalMs <= 0) return '';
  const ratio = Math.max(0, Math.min(1, ms / totalMs));
  const pos = Math.floor(narration.length * ratio);
  const start = Math.max(0, pos - 4);
  const end = Math.min(narration.length, pos + 22);
  return narration.slice(start, end);
}
