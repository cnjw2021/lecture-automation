/**
 * 카테고리 F — Playwright 순방향 싱크 타이밍 검증.
 *
 * TTS·녹화 전에 syncPoints 세그먼트별 narration budget 이 visible action
 * budget 을 덮을 수 있는지 검사한다. sync-playwright 는 wait 만 재분배할 수
 * 있으므로, fixed action 이 세그먼트 narration 보다 길면 구조적으로 sync 불가.
 *
 * 주의: 이 룰은 pre-TTS 구조 검증이다. phrase 시점은 narration 문자 위치 비율로
 * 선형 보간한 추산값이므로, 실제 TTS 발화 분포(초반 빠름/문장 끝 늘어짐 등)와는
 * 다를 수 있어 borderline 케이스에서 false positive 가 날 수 있다. 최종 sync 는
 * 1.7b 단계에서 alignment.json (글자 단위 타임스탬프) 기반으로 다시 수행되므로,
 * 본 룰은 명백한 구조적 sync 불가 케이스를 작성 단계에서 사전 차단하는 것이 목적.
 */

import { PlaywrightAction, PlaywrightSyncPoint } from '../entities/Lecture';
import { isForwardSyncTarget } from '../policies/LiveDemoScenePolicy';
import {
  estimateActionsDurationMs,
  estimateFixedActionDurationMs,
  PLAYWRIGHT_TIMING,
} from '../playwright/ActionTiming';
import { LintIssue, LintRule } from './types';

const CHARS_PER_SEC = 5.5;
const FORWARD_SYNC_FORBIDDEN_CMDS = new Set<string>(['goto', 'wait', 'wait_for', 'wait_for_claude_ready']);
/**
 * forward sync 씬에서 visible(offscreen 아님) 로 두면 budget 추정이 깨지는 cmd.
 * - wait_for / wait_for_claude_ready: 비결정적 대기. ActionTiming 에서 0ms 로 처리되므로
 *   visible 로 두면 실제 수 초~수 분 지연이 budget 에서 빠짐. shared session 은 offscreen 으로 밀어야 함.
 * - render_code_block: Artifact iframe 폴링으로 최대 30s. visible budget 에 포함시킬 수 없음.
 */
const FORWARD_SYNC_VISIBLE_FORBIDDEN_CMDS = new Set<string>([
  'wait_for',
  'wait_for_claude_ready',
  'render_code_block',
]);

export const playwrightTimingRule: LintRule = {
  id: 'F-playwright-timing',
  description: 'Playwright 순방향 싱크 세그먼트별 action budget 검증',

  run(lecture: any): LintIssue[] {
    const issues: LintIssue[] = [];
    if (!lecture?.sequence || !Array.isArray(lecture.sequence)) return issues;

    for (const scene of lecture.sequence) {
      if (!isForwardSyncTarget(scene)) continue;

      const sceneId = scene.scene_id ?? null;
      const narration: string = typeof scene.narration === 'string' ? scene.narration : '';
      const actions: PlaywrightAction[] = Array.isArray(scene.visual?.action) ? scene.visual.action : [];
      const syncPoints: PlaywrightSyncPoint[] = Array.isArray(scene.visual?.syncPoints) ? scene.visual.syncPoints : [];
      if (actions.length === 0 || syncPoints.length === 0 || narration.length === 0) continue;

      const sortedSyncPoints = [...syncPoints]
        .filter(sp => typeof sp.actionIndex === 'number' && sp.actionIndex >= 0 && sp.actionIndex < actions.length)
        .sort((a, b) => a.actionIndex - b.actionIndex);
      if (sortedSyncPoints.length === 0) continue;

      // visible 로 두면 budget 이 깨지는 비결정적 / 가변 대기 cmd 검사
      for (let i = 0; i < actions.length; i++) {
        const action = actions[i];
        if (!FORWARD_SYNC_VISIBLE_FORBIDDEN_CMDS.has(action.cmd)) continue;
        if (action.offscreen) continue;
        issues.push({
          ruleId: this.id,
          sceneId,
          severity: 'error',
          message: `action[${i}] cmd=${action.cmd} 가 visible(offscreen 아님) — 비결정적/가변 대기는 budget 추정이 불가하므로 offscreen: true 로 씬 타임라인 밖으로 밀거나, isolated 역방향 싱크 씬으로 분리해야 함`,
        });
      }

      for (const sp of sortedSyncPoints) {
        const action = actions[sp.actionIndex];
        if (!action) continue;
        if (action.offscreen) {
          issues.push({
            ruleId: this.id,
            sceneId,
            severity: 'error',
            message: `syncPoint action[${sp.actionIndex}] 가 offscreen — offscreen action 은 클립 타임라인 밖에서 실행되어 step/manifest 타임스탬프가 없으므로 forward sync 의 세그먼트 피벗으로 사용 불가. visible teaching action 으로 옮겨야 함`,
          });
          continue;
        }
        if (FORWARD_SYNC_FORBIDDEN_CMDS.has(action.cmd)) {
          issues.push({
            ruleId: this.id,
            sceneId,
            severity: 'error',
            message: `syncPoint action[${sp.actionIndex}] 가 ${action.cmd} — syncPoint 는 setup/wait 가 아니라 실제 teaching action(type, press, mouse_move, highlight 등)에 둬야 함`,
          });
        }
      }

      const totalMs = estimateNarrationDurationMs(scene, narration);
      const targetFirings = buildTargetFirings(narration, sortedSyncPoints, totalMs);
      if (!targetFirings) continue;

      const firstSync = sortedSyncPoints[0];
      const setupActions = actions.slice(0, firstSync.actionIndex);
      const setupFixedMs = estimateActionsDurationMs(setupActions);
      const firstTargetMs = targetFirings[0].targetMs;
      const setupRequiredMs = setupFixedMs + PLAYWRIGHT_TIMING.setupFloorSlackMs;
      if (setupFixedMs > 0 && firstTargetMs < setupRequiredMs) {
        issues.push({
          ruleId: this.id,
          sceneId,
          severity: 'error',
          message: `첫 syncPoint action[${firstSync.actionIndex}] phrase 시점 ${formatSec(firstTargetMs)}가 setup floor ${formatSec(setupRequiredMs)}보다 빠름 — goto/mouse/click 이후 첫 teaching phrase 로 늦춰야 함`,
        });
      }

      const segments = buildSegments(sortedSyncPoints, actions.length);
      for (let si = 0; si < segments.length; si++) {
        const { from, to } = segments[si];
        const segStartMs = si === 0 ? 0 : targetFirings[si - 1]?.targetMs ?? 0;
        const segEndMs = si < targetFirings.length ? targetFirings[si].targetMs : totalMs;
        const targetSegMs = segEndMs - segStartMs;
        if (targetSegMs <= 0) continue;

        const segmentActions = actions.slice(from, to).filter(action => !action.offscreen);
        const fixedMs = estimateActionsDurationMs(segmentActions);
        const waitCount = segmentActions.filter(action => action.cmd === 'wait').length;
        const requiredMs = fixedMs + PLAYWRIGHT_TIMING.segmentSlackMs;

        if (fixedMs > targetSegMs) {
          issues.push({
            ruleId: this.id,
            sceneId,
            severity: 'error',
            message: `segment ${si} actions ${from}~${to - 1}: fixed action ${formatSec(fixedMs)} > narration budget ${formatSec(targetSegMs)} — wait=0으로도 싱크 불가 (${summarizeFixedActions(segmentActions)})`,
          });
        } else if (requiredMs > targetSegMs) {
          issues.push({
            ruleId: this.id,
            sceneId,
            severity: 'warning',
            message: `segment ${si} actions ${from}~${to - 1}: 여유 ${formatSec(targetSegMs - fixedMs)}가 1초 미만 — 후반 무음/타이핑 꼬리 위험 (${summarizeFixedActions(segmentActions)})`,
          });
        }

        if (waitCount === 0 && fixedMs > 0) {
          issues.push({
            ruleId: this.id,
            sceneId,
            severity: 'warning',
            message: `segment ${si} actions ${from}~${to - 1}: wait 액션이 없어 sync-playwright 가 이 구간을 조정할 수 없음`,
          });
        }
      }
    }

    return issues;
  },
};

function estimateNarrationDurationMs(scene: any, narration: string): number {
  if (typeof scene.durationSec === 'number' && scene.durationSec > 0) {
    return scene.durationSec * 1000;
  }
  return Math.ceil(narration.length / CHARS_PER_SEC) * 1000;
}

function buildTargetFirings(
  narration: string,
  sortedSyncPoints: PlaywrightSyncPoint[],
  totalMs: number,
): { actionIndex: number; targetMs: number }[] | null {
  const narrationLength = Math.max(1, narration.length);
  const result: { actionIndex: number; targetMs: number }[] = [];
  for (const sp of sortedSyncPoints) {
    const pos = narration.indexOf(sp.phrase);
    if (pos < 0 || pos !== narration.lastIndexOf(sp.phrase)) return null;
    result.push({ actionIndex: sp.actionIndex, targetMs: Math.round((pos / narrationLength) * totalMs) });
  }
  return result;
}

function buildSegments(sortedSyncPoints: PlaywrightSyncPoint[], totalActions: number): { from: number; to: number }[] {
  const pivots = sortedSyncPoints.map(sp => sp.actionIndex);
  pivots.push(totalActions);

  const segments: { from: number; to: number }[] = [];
  let from = 0;
  for (const pivot of pivots) {
    if (pivot > from) segments.push({ from, to: pivot });
    from = Math.max(from, pivot);
  }
  if (from < totalActions) segments.push({ from, to: totalActions });
  return segments;
}

function summarizeFixedActions(actions: PlaywrightAction[]): string {
  const parts = actions
    .filter(action => action.cmd !== 'wait' && !action.offscreen)
    .map(action => {
      const estimate = estimateFixedActionDurationMs(action);
      return `${action.cmd}=${formatSec(estimate.ms)}`;
    });
  return parts.length > 0 ? parts.join(', ') : 'fixed action 없음';
}

function formatSec(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`;
}
