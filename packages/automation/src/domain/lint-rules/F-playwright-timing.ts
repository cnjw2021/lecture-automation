/**
 * 카테고리 F — Playwright 순방향 싱크 타이밍 검증.
 *
 * TTS·녹화 전에 syncPoints 세그먼트별 narration budget 이 visible action
 * budget 을 덮을 수 있는지 검사한다. sync-playwright 는 wait 만 재분배할 수
 * 있으므로, fixed action 이 세그먼트 narration 보다 길면 구조적으로 sync 불가.
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

      for (const sp of sortedSyncPoints) {
        const action = actions[sp.actionIndex];
        if (!action) continue;
        if (action.cmd === 'goto' || action.cmd === 'wait' || action.cmd === 'wait_for') {
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
        const requiredMs = fixedMs + PLAYWRIGHT_TIMING.setupFloorSlackMs;

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
