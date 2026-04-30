/**
 * 카테고리 G — Playwright forward-sync 씬의 syncPoint 커버리지 검증.
 *
 * #141 옵션 A + D 적용 (2026-04-29):
 *   - STRICT 모드 전용 룰로 강등 (`strictOnly: true`). 일반 `make lint` 에서는 침묵.
 *   - 출력 압축: 씬당 최대 1 개의 metric 경고만 노출. 개별 type/highlight action 마다
 *     중복 경고를 발생시키던 G-1 은 카운트 메트릭으로 통합.
 *
 * 진짜 sync 검증은 `make sync-preview` 가 담당한다. 본 룰은 정적 휴리스틱이므로
 * "syncPoint 가 더 있는 편이 좋다" 는 권유 수준이며, 실제 drift 가 발생하는지는
 * alignment.json/문자수 기반 시뮬레이션으로만 확정 가능.
 *
 * 검출 메트릭 (씬 단위, warning):
 *   - unanchoredTeachingActions: 인접 syncPoint 가 없는 teaching action 개수
 *   - underAnchored: syncPoint ≤ 1 + action ≥ 5 + fixed 비율 ≥ 30%
 *   둘 중 하나라도 양수면 단일 압축 경고를 발행.
 */

import { LintIssue, LintRule } from './types';
import { isForwardSyncTarget } from '../policies/LiveDemoScenePolicy';
import { estimateFixedActionDurationMs } from '../playwright/ActionTiming';
import { getTeachingCmds } from '../playwright/PlaywrightCmdMetadata';

const TEACHING_CMDS = new Set<string>(getTeachingCmds());
const NEAR_SYNCPOINT_TOLERANCE = 2;
const UNDER_ANCHORED_MIN_ACTIONS = 5;
const UNDER_ANCHORED_MAX_SYNCPOINTS = 1;
const UNDER_ANCHORED_FIXED_RATIO_THRESHOLD = 0.3;

export const playwrightSyncCoverageRule: LintRule = {
  id: 'G-playwright-sync-coverage',
  description: 'Playwright forward-sync 씬의 syncPoint 커버리지 검증 (STRICT 전용)',
  strictOnly: true,

  run(lecture: any): LintIssue[] {
    const issues: LintIssue[] = [];
    if (!lecture?.sequence || !Array.isArray(lecture.sequence)) return issues;

    for (const scene of lecture.sequence) {
      if (!isForwardSyncTarget(scene)) continue;

      const sceneId = scene.scene_id ?? null;
      const visual = scene?.visual;
      const actions = Array.isArray(visual?.action) ? visual.action : [];
      const syncPoints = Array.isArray(visual?.syncPoints) ? visual.syncPoints : [];
      const syncedActionIndices: number[] = syncPoints
        .map((sp: any) => sp?.actionIndex)
        .filter((i: any) => Number.isInteger(i));
      const syncedSet = new Set<number>(syncedActionIndices);

      let unanchoredCount = 0;
      for (let i = 0; i < actions.length; i++) {
        const a = actions[i];
        if (!a || typeof a !== 'object') continue;
        if (a.offscreen) continue;
        if (!TEACHING_CMDS.has(a.cmd)) continue;
        if (syncedSet.has(i)) continue;
        const hasNearby = syncedActionIndices.some(
          (idx) => Math.abs(idx - i) <= NEAR_SYNCPOINT_TOLERANCE,
        );
        if (!hasNearby) unanchoredCount++;
      }

      let underAnchored = false;
      let fixedMs = 0;
      let fixedRatio = 0;
      const sceneMs = (scene.durationSec ?? 0) * 1000;
      if (
        syncPoints.length <= UNDER_ANCHORED_MAX_SYNCPOINTS &&
        actions.length >= UNDER_ANCHORED_MIN_ACTIONS &&
        sceneMs > 0
      ) {
        for (const a of actions) {
          if (!a || typeof a !== 'object') continue;
          if (a.offscreen || a.cmd === 'wait') continue;
          fixedMs += estimateFixedActionDurationMs(a).ms;
        }
        fixedRatio = fixedMs / sceneMs;
        if (fixedRatio >= UNDER_ANCHORED_FIXED_RATIO_THRESHOLD) {
          underAnchored = true;
        }
      }

      if (unanchoredCount === 0 && !underAnchored) continue;

      const parts: string[] = [];
      if (unanchoredCount > 0) {
        parts.push(`unanchored teaching action ${unanchoredCount} 개`);
      }
      if (underAnchored) {
        parts.push(
          `under-anchored (syncPoint ${syncPoints.length}/${actions.length} action, ` +
          `fixed ${(fixedRatio * 100).toFixed(0)}%)`,
        );
      }
      issues.push({
        ruleId: 'G-playwright-sync-coverage',
        sceneId,
        severity: 'warning',
        message:
          `${parts.join(' + ')} — ` +
          `'make sync-preview LECTURE=... SCENE=${sceneId}' 로 실제 drift 확인 후 ` +
          `필요하면 syncPoint 추가`,
      });
    }

    return issues;
  },
};
