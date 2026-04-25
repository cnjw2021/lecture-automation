/**
 * SyncPlaywrightUseCase
 *
 * 이미 생성된 TTS WAV 파일을 분석해서 Playwright 씬의 wait ms를 자동 재계산한다.
 *
 * 알고리즘:
 *   1. WAV PCM 데이터의 RMS 묵음 구간을 탐지 → 일본어 문장(。) 경계 시각 추출
 *   2. syncPoint의 phrase가 속한 문장 번호를 특정 → 그 문장의 시작 시각 취득
 *   3. 씬을 syncPoints로 세그먼트 분할 → 각 세그먼트의 wait ms를 비례 재분배
 *
 * WAV 파일이 없는 경우 → 문자수 비례 추산으로 폴백 (TTS 미생성 상태에서 CLI 사용 시)
 */

import * as fs from 'fs-extra';
import { Lecture, Scene, PlaywrightVisual, PlaywrightAction, PlaywrightSyncPoint } from '../../domain/entities/Lecture';
import { ILectureRepository } from '../../domain/interfaces/ILectureRepository';
import { isForwardSyncTarget, isIsolatedLiveDemoScene } from '../../domain/policies/LiveDemoScenePolicy';
import { estimateFixedActionDurationMs } from '../../domain/playwright/ActionTiming';

// ---------------------------------------------------------------------------
// Use Case
// ---------------------------------------------------------------------------

export class SyncPlaywrightUseCase {
  constructor(private readonly lectureRepository: ILectureRepository) {}

  /**
   * 강의 전체 playwright 씬을 처리.
   * 원본 lecture 객체를 변경하지 않고 업데이트된 복사본을 반환한다.
   */
  async execute(
    lecture: Lecture,
    options: { sceneIds?: number[] } = {},
  ): Promise<{ updatedLecture: Lecture; changedSceneIds: number[] }> {
    const updatedSequence = lecture.sequence.map(s => ({ ...s }));
    const changedSceneIds: number[] = [];
    const targetSceneIds = options.sceneIds;

    for (let i = 0; i < updatedSequence.length; i++) {
      const scene = updatedSequence[i];
      if (targetSceneIds && !targetSceneIds.includes(scene.scene_id)) continue;
      if (isIsolatedLiveDemoScene(scene)) {
        console.log(`\n[Sync] Scene ${scene.scene_id} 는 isolated 라이브 데모 (역방향 싱크 대상) → 순방향 싱크 건너뜀`);
        continue;
      }
      if (!isForwardSyncTarget(scene)) continue;
      const visual = scene.visual as PlaywrightVisual;

      console.log(`\n[Sync] Scene ${scene.scene_id} 처리 중...`);

      try {
        const updatedActions = await this.syncScene(scene, visual, lecture.lecture_id);
        updatedSequence[i] = {
          ...scene,
          visual: { ...visual, action: updatedActions },
        };
        changedSceneIds.push(scene.scene_id);
      } catch (err) {
        console.error(`  ❌ Scene ${scene.scene_id} 싱크 실패:`, (err as Error).message);
      }
    }

    return {
      updatedLecture: { ...lecture, sequence: updatedSequence },
      changedSceneIds,
    };
  }

  // ---------------------------------------------------------------------------
  // Private
  // ---------------------------------------------------------------------------

  private async syncScene(scene: Scene, visual: PlaywrightVisual, lectureId: string): Promise<PlaywrightAction[]> {
    const { syncPoints, action: actions } = visual;
    if (!syncPoints || syncPoints.length === 0) return actions;

    // 1. WAV 파일로 타이밍 취득
    const wavPath = this.lectureRepository.getAudioPath(lectureId, scene.scene_id);
    const timings = await resolvePhraseTimings(scene.narration, syncPoints, wavPath);
    const totalMs = timings.totalMs;

    // 2. syncPoints를 actionIndex 오름차순 정렬
    const sortedSyncPoints = [...syncPoints].sort((a, b) => a.actionIndex - b.actionIndex);

    // 3. 각 syncPoint의 타겟 발화 시각
    const targetFirings = buildTargetFirings(scene.narration, sortedSyncPoints, timings);

    // 4. 세그먼트 분할 후 wait 재계산
    const segments = buildSegments(sortedSyncPoints, actions.length);
    const updatedActions = [...actions];

    for (let si = 0; si < segments.length; si++) {
      const { from, to } = segments[si];
      const segStartMs = si === 0 ? 0 : targetFirings[si - 1].targetMs;
      const segEndMs   = si < targetFirings.length ? targetFirings[si].targetMs : totalMs;
      const targetSegDurationMs = segEndMs - segStartMs;

      if (targetSegDurationMs <= 0) {
        console.warn(`  ⚠️ 세그먼트 ${si} (actions ${from}~${to - 1}): 목표 duration=${targetSegDurationMs}ms ≤ 0, 건너뜁니다.`);
        continue;
      }

      // 고정 시간 / 조정 가능한 wait 파악
      // offscreen 액션은 클립 타임라인 바깥에서 실행되므로 싱크 계산에서 완전히 제외
      const waitIndices: number[] = [];
      let fixedMs = 0;
      for (let j = from; j < to; j++) {
        if (actions[j].offscreen) continue;
        if (actions[j].cmd === 'wait') {
          waitIndices.push(j);
        } else {
          fixedMs += estimateFixedActionDurationMs(actions[j]).ms;
        }
      }

      if (waitIndices.length === 0) {
        console.warn(`  ⚠️ 세그먼트 ${si} (actions ${from}~${to - 1}): wait 액션 없음, 조정 불가`);
        continue;
      }

      // 기존 wait 합계 대비 비례 분배
      const currentWaitTotal = waitIndices.reduce((sum, idx) => sum + (actions[idx].ms ?? 0), 0);
      const availableMs = Math.max(0, targetSegDurationMs - fixedMs);
      const deficitMs = fixedMs - targetSegDurationMs;

      if (deficitMs > 0) {
        console.warn(
          `  ⚠️ 세그먼트 ${si} (actions ${from}~${to - 1}): ` +
          `고정 액션 ${fixedMs}ms가 목표 ${targetSegDurationMs}ms를 ${deficitMs}ms 초과 — ` +
          `wait=0으로 줄여도 액션이 나레이션보다 늦습니다. narration/syncPoint/action 분할 조정 필요`
        );
      }

      for (const idx of waitIndices) {
        const original = actions[idx].ms ?? 0;
        const ratio = currentWaitTotal > 0 ? original / currentWaitTotal : 1 / waitIndices.length;
        updatedActions[idx] = { ...actions[idx], ms: Math.round(availableMs * ratio) };
      }

      const newWaitTotal = waitIndices.reduce((sum, idx) => sum + (updatedActions[idx].ms ?? 0), 0);
      console.log(
        `  세그먼트 ${si} (actions ${from}~${to - 1}): ` +
        `목표 ${targetSegDurationMs}ms, 고정 ${fixedMs}ms, wait ${currentWaitTotal}→${newWaitTotal}ms`
      );
    }

    return updatedActions;
  }
}

// ---------------------------------------------------------------------------
// WAV 분석 및 타이밍 취득
// ---------------------------------------------------------------------------

interface PhraseTimingResult {
  totalMs: number;
  phraseStartMs: Map<number, number>;  // actionIndex → startMs
  method: 'alignment' | 'wav-analysis' | 'char-count';
}

/**
 * scene-N.alignment.json 의 글자 단위 타임스탬프로 phrase 시각을 직접 조회.
 * - assembler 가 삽입한 경계 gap 이 있어도 alignment 는 gap 을 반영해 shift 된 상태
 * - 각 phrase 의 첫 글자 위치를 alignment.characters 에서 찾아 그 start 시각을 반환
 * - phrase 미발견 / 파일 누락 / 포맷 불일치 시 null → 상위 경로가 WAV 분석으로 fallback
 */
async function resolveFromAlignment(
  alignmentPath: string,
  syncPoints: PlaywrightSyncPoint[],
): Promise<PhraseTimingResult | null> {
  if (!(await fs.pathExists(alignmentPath))) return null;

  let alignment: {
    characters?: string[];
    character_start_times_seconds?: number[];
    character_end_times_seconds?: number[];
  };
  try {
    alignment = await fs.readJson(alignmentPath);
  } catch (err) {
    console.warn(`  ⚠️ alignment.json 로드 실패 (${alignmentPath}) — WAV 분석으로 fallback: ${err}`);
    return null;
  }

  const chars = alignment.characters;
  const startTimes = alignment.character_start_times_seconds;
  const endTimes = alignment.character_end_times_seconds;
  if (
    !Array.isArray(chars) ||
    !Array.isArray(startTimes) ||
    !Array.isArray(endTimes) ||
    chars.length === 0 ||
    chars.length !== startTimes.length ||
    chars.length !== endTimes.length
  ) {
    console.warn(`  ⚠️ alignment.json 포맷 불일치 — WAV 분석으로 fallback`);
    return null;
  }

  const concatChars = chars.join('');
  const totalMs = Math.max(0, Math.round(endTimes[endTimes.length - 1] * 1000));

  const phraseStartMs = new Map<number, number>();
  for (const sp of syncPoints) {
    const pos = concatChars.indexOf(sp.phrase);
    if (pos < 0) {
      console.warn(`  ⚠️ alignment 에서 phrase "${sp.phrase.slice(0, 20)}" 못 찾음 — WAV 분석으로 fallback`);
      return null;
    }
    const sec = Math.max(0, startTimes[pos]);
    const ms = Math.round(sec * 1000);
    phraseStartMs.set(sp.actionIndex, ms);
    console.log(`  [ALIGN] action[${sp.actionIndex}] "${sp.phrase.slice(0, 16)}..." → ${ms}ms`);
  }

  return { totalMs, phraseStartMs, method: 'alignment' };
}

async function resolvePhraseTimings(
  narration: string,
  syncPoints: PlaywrightSyncPoint[],
  wavPath: string,
): Promise<PhraseTimingResult> {
  // 1순위: alignment.json 기반 (글자 단위 타임스탬프). gap 삽입·무음 분포와 무관하게 정확.
  const alignmentPath = wavPath.replace(/\.wav$/, '.alignment.json');
  const fromAlignment = await resolveFromAlignment(alignmentPath, syncPoints);
  if (fromAlignment) return fromAlignment;

  // 2순위: WAV 파일 RMS 묵음 분석
  if (await fs.pathExists(wavPath)) {
    const wavBuffer = await fs.readFile(wavPath);
    const totalMs = getWavDurationMs(wavBuffer);
    const sentenceStartTimes = getSentenceStartTimes(narration, wavBuffer);

    if (sentenceStartTimes) {
      const phraseStartMs = new Map<number, number>();
      let allResolved = true;

      for (const sp of syncPoints) {
        const ms = getPhraseStartMs(sp.phrase, narration, sentenceStartTimes, totalMs);
        if (ms !== null) {
          phraseStartMs.set(sp.actionIndex, ms);
          console.log(`  [WAV] action[${sp.actionIndex}] "${sp.phrase.slice(0, 16)}..." → ${ms}ms`);
        } else {
          console.warn(`  ⚠️ phrase "${sp.phrase.slice(0, 20)}" 위치 특정 실패`);
          allResolved = false;
        }
      }

      if (allResolved) {
        return { totalMs, phraseStartMs, method: 'wav-analysis' };
      }
      // 일부 실패 시 실패한 것만 문자수로 보완
      for (const sp of syncPoints) {
        if (!phraseStartMs.has(sp.actionIndex)) {
          const ms = charCountEstimate(sp.phrase, narration, totalMs);
          phraseStartMs.set(sp.actionIndex, ms);
          console.log(`  [추산] action[${sp.actionIndex}] "${sp.phrase.slice(0, 16)}..." → ${ms}ms`);
        }
      }
      return { totalMs, phraseStartMs, method: 'wav-analysis' };
    }

    // 묵음 감지 실패 → WAV 길이는 정확하므로 문자수 비례만 대체
    console.warn('  ⚠️ 묵음 경계 감지 실패 → 문자수 비례 추산 (WAV 길이 기준)');
    return charCountFallback(narration, syncPoints, totalMs);
  }

  // WAV 없음 → JSON의 durationSec 사용 (TTS 미생성 상태)
  console.warn(`  ⚠️ WAV 없음 (${wavPath}), 문자수 비례 추산으로 폴백`);
  const durationMs = (narration.length / 5) * 1000;  // 1초 ≒ 5자 기준
  return charCountFallback(narration, syncPoints, durationMs);
}

function charCountFallback(
  narration: string,
  syncPoints: PlaywrightSyncPoint[],
  totalMs: number,
): PhraseTimingResult {
  const phraseStartMs = new Map<number, number>();
  for (const sp of syncPoints) {
    const ms = charCountEstimate(sp.phrase, narration, totalMs);
    phraseStartMs.set(sp.actionIndex, ms);
    console.log(`  [추산] action[${sp.actionIndex}] "${sp.phrase.slice(0, 16)}..." → ${ms}ms`);
  }
  return { totalMs, phraseStartMs, method: 'char-count' };
}

function charCountEstimate(phrase: string, narration: string, totalMs: number): number {
  const pos = narration.indexOf(phrase);
  if (pos === -1) return 0;
  return Math.round((pos / narration.length) * totalMs);
}

// ---------------------------------------------------------------------------
// WAV 묵음 분석
// ---------------------------------------------------------------------------

/** WAV 오디오 길이를 ms 단위로 반환 (44-byte RIFF 헤더 제외). */
function getWavDurationMs(wavBuffer: Buffer, sampleRate = 24000): number {
  const pcmBytes = Math.max(0, wavBuffer.length - 44);
  return Math.round((pcmBytes / 2 / sampleRate) * 1000);  // 16-bit = 2 bytes/sample
}

/**
 * WAV PCM의 RMS 묵음 구간을 탐지해 일본어 문장(。) 경계 시각 배열을 반환.
 * 실패(묵음 수 부족) 시 null 반환.
 *
 * @returns [sentence[0] 시작, sentence[1] 시작, ...] ms 배열, 또는 null
 */
function getSentenceStartTimes(narration: string, wavBuffer: Buffer): number[] | null {
  const sentences = splitJapaneseSentences(narration);
  if (sentences.length <= 1) return [0];

  const expectedBoundaries = sentences.length - 1;
  const silences = detectSilences(wavBuffer);

  if (silences.length < expectedBoundaries) {
    return null;
  }

  // 가장 깊은(묵음량 큰) N개를 취해 시간순 정렬 → 문장 경계 시각
  const boundaries = silences
    .slice(0, expectedBoundaries)          // 이미 depth 내림차순 정렬됨
    .map(s => s.endMs)                      // 묵음 종료 = 다음 문장 시작
    .sort((a, b) => a - b);                 // 시간 오름차순

  // 단순 단조 증가 검증
  for (let i = 1; i < boundaries.length; i++) {
    if (boundaries[i] <= boundaries[i - 1]) return null;
  }

  return [0, ...boundaries];
}

interface SilenceRegion {
  startMs: number;
  endMs: number;
  depth: number;  // 낮을수록 더 완전한 묵음 (RMS 최솟값)
}

/**
 * WAV PCM에서 묵음 구간을 탐지.
 * depth 오름차순(깊은 묵음 우선)으로 정렬해 반환.
 */
function detectSilences(wavBuffer: Buffer, sampleRate = 24000): SilenceRegion[] {
  const pcm = wavBuffer.slice(44);
  const WINDOW_MS = 20;
  const windowSamples = Math.floor(sampleRate * WINDOW_MS / 1000);
  const MIN_SILENCE_MS = 130;   // 이보다 짧은 묵음은 무시 (조음 포즈 등 오탐 방지)

  // 각 윈도우의 RMS 계산
  const rmsValues: number[] = [];
  for (let offset = 0; offset < pcm.length; offset += windowSamples * 2) {
    let sumSq = 0;
    let count = 0;
    for (let i = offset; i < Math.min(offset + windowSamples * 2, pcm.length) - 1; i += 2) {
      const sample = pcm.readInt16LE(i);
      sumSq += sample * sample;
      count++;
    }
    rmsValues.push(count > 0 ? Math.sqrt(sumSq / count) : 0);
  }

  // 동적 임계값: 최대 RMS의 7%
  const maxRms = Math.max(...rmsValues, 1);
  const threshold = maxRms * 0.07;

  // 묵음 구간 탐지
  const silences: SilenceRegion[] = [];
  let inSilence = false;
  let silStart = 0;
  let minRmsInSilence = Infinity;

  for (let i = 0; i < rmsValues.length; i++) {
    const ms = i * WINDOW_MS;
    if (rmsValues[i] <= threshold) {
      if (!inSilence) {
        inSilence = true;
        silStart = ms;
        minRmsInSilence = rmsValues[i];
      } else {
        minRmsInSilence = Math.min(minRmsInSilence, rmsValues[i]);
      }
    } else if (inSilence) {
      inSilence = false;
      const duration = ms - silStart;
      if (duration >= MIN_SILENCE_MS) {
        silences.push({ startMs: silStart, endMs: ms, depth: minRmsInSilence });
      }
    }
  }
  if (inSilence) {
    silences.push({ startMs: silStart, endMs: rmsValues.length * WINDOW_MS, depth: minRmsInSilence });
  }

  // 깊은 묵음(depth 낮음) 우선으로 정렬
  return silences.sort((a, b) => a.depth - b.depth);
}

// ---------------------------------------------------------------------------
// 문장/구절 위치 매핑
// ---------------------------------------------------------------------------

/** 일본어 문장(。구분)을 배열로 분할. 구분자(。)는 앞 문장에 포함. */
function splitJapaneseSentences(narration: string): string[] {
  const result: string[] = [];
  let current = '';
  for (const ch of narration) {
    current += ch;
    if (ch === '。') {
      result.push(current);
      current = '';
    }
  }
  if (current.trim()) result.push(current);
  return result;
}

/**
 * phrase가 속한 문장의 시작 시각을 ms로 반환.
 * 문장 내 위치를 문자수로 보간하여 더 정밀하게 계산.
 */
function getPhraseStartMs(
  phrase: string,
  narration: string,
  sentenceStartTimes: number[],
  totalMs: number,
): number | null {
  const sentences = splitJapaneseSentences(narration);
  const phrasePos = narration.indexOf(phrase);
  if (phrasePos === -1) return null;

  let cumChars = 0;
  for (let i = 0; i < sentences.length; i++) {
    const sentEnd = cumChars + sentences[i].length;
    if (phrasePos < sentEnd) {
      const sentStartMs = sentenceStartTimes[i];
      const sentEndMs   = sentenceStartTimes[i + 1] ?? totalMs;
      const sentDuration = sentEndMs - sentStartMs;
      const offsetInSent = phrasePos - cumChars;
      // 문장 내 위치를 문자수로 보간
      const phraseMs = sentStartMs + (offsetInSent / sentences[i].length) * sentDuration;
      return Math.round(phraseMs);
    }
    cumChars += sentences[i].length;
  }
  return null;
}

// ---------------------------------------------------------------------------
// 세그먼트 분할 / 타겟 시각 계산
// ---------------------------------------------------------------------------

interface TargetFiring { actionIndex: number; targetMs: number; }

function buildTargetFirings(
  narration: string,
  sortedSyncPoints: PlaywrightSyncPoint[],
  timings: PhraseTimingResult,
): TargetFiring[] {
  return sortedSyncPoints.map(sp => {
    const ms = timings.phraseStartMs.get(sp.actionIndex);
    if (ms !== undefined) return { actionIndex: sp.actionIndex, targetMs: ms };
    // 마지막 안전망
    const fallback = charCountEstimate(sp.phrase, narration, timings.totalMs);
    return { actionIndex: sp.actionIndex, targetMs: fallback };
  });
}

/**
 * syncPoints의 actionIndex를 경계로 actions를 세그먼트로 분할.
 * 결과: [{from, to}] — each segment = actions[from..to)
 */
function buildSegments(sortedSyncPoints: PlaywrightSyncPoint[], totalActions: number): { from: number; to: number }[] {
  const pivots = sortedSyncPoints.map(sp => sp.actionIndex);
  pivots.push(totalActions);

  const segments: { from: number; to: number }[] = [];
  let from = 0;
  for (const pivot of pivots) {
    if (pivot > from) {
      segments.push({ from, to: pivot });
    }
    from = Math.max(from, pivot);
  }
  if (from < totalActions) {
    segments.push({ from, to: totalActions });
  }
  return segments;
}
