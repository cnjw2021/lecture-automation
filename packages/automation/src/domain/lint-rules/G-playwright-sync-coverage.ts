/**
 * 카테고리 G — Playwright forward-sync 씬의 syncPoint 커버리지 검증.
 *
 * 검출 대상 (모두 warning):
 *   G-1. teaching action (type / highlight / prefill_codepen / mouse_drag / DevTools 조작) 이 있는데
 *        그 action 또는 인접 action 을 가리키는 syncPoint 가 없음 (narration 과 drift 위험)
 *   G-2. under-anchored: syncPoint ≤ 1 개 + action ≥ 5 개 + fixed action 시간이 씬 길이의 30% 이상
 *        → wait 가 균등 분배되어 teaching action 이 narration 보다 한참 늦게 발화될 가능성 높음
 *
 * 본 룰은 사전 차단이 목적. 실제 drift 시각 측정은 `make sync-preview` 시뮬레이터로.
 */

import { LintIssue, LintRule } from './types';
import { isForwardSyncTarget } from '../policies/LiveDemoScenePolicy';
import { estimateFixedActionDurationMs } from '../playwright/ActionTiming';

/**
 * 학습 효과를 직접 만드는 visible 액션. 본 액션의 발화 시점이 narration 과 어긋나면
 * 시청자가 즉시 이상함을 느낀다. syncPoint 로 anchor 되어 있어야 함.
 */
const TEACHING_CMDS = new Set<string>([
  'type',
  'highlight',
  'prefill_codepen',
  'mouse_drag',
  'open_devtools',
  'select_devtools_node',
  'toggle_devtools_node',
]);

/** teaching action 으로부터 ±N action 이내에 syncPoint 가 있으면 anchor 로 인정 */
const NEAR_SYNCPOINT_TOLERANCE = 2;

/** under-anchored 판정 임계값 */
const UNDER_ANCHORED_MIN_ACTIONS = 5;
const UNDER_ANCHORED_MAX_SYNCPOINTS = 1;
const UNDER_ANCHORED_FIXED_RATIO_THRESHOLD = 0.3;

export const playwrightSyncCoverageRule: LintRule = {
  id: 'G-playwright-sync-coverage',
  description: 'Playwright forward-sync 씬의 syncPoint 커버리지 검증',

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

      // G-1: 각 teaching action 에 인접 syncPoint 가 있는지 확인
      for (let i = 0; i < actions.length; i++) {
        const a = actions[i];
        if (!a || typeof a !== 'object') continue;
        if (a.offscreen) continue;
        if (!TEACHING_CMDS.has(a.cmd)) continue;
        if (syncedSet.has(i)) continue;

        const hasNearby = syncedActionIndices.some(
          (idx) => Math.abs(idx - i) <= NEAR_SYNCPOINT_TOLERANCE,
        );
        if (!hasNearby) {
          issues.push({
            ruleId: this.id,
            sceneId,
            severity: 'warning',
            message:
              `action[${i}] cmd=${a.cmd} 가 teaching action 인데 인접 syncPoint 없음 — ` +
              `narration 과 drift 위험. 'make sync-preview LECTURE=... SCENE=${sceneId}' 로 실제 drift 확인 후 syncPoint 추가 권장`,
          });
        }
      }

      // G-2: under-anchored 검출
      if (
        syncPoints.length <= UNDER_ANCHORED_MAX_SYNCPOINTS &&
        actions.length >= UNDER_ANCHORED_MIN_ACTIONS
      ) {
        let fixedMs = 0;
        for (const a of actions) {
          if (!a || typeof a !== 'object') continue;
          if (a.offscreen || a.cmd === 'wait') continue;
          fixedMs += estimateFixedActionDurationMs(a).ms;
        }
        const sceneMs = (scene.durationSec ?? 0) * 1000;
        if (sceneMs > 0) {
          const ratio = fixedMs / sceneMs;
          if (ratio >= UNDER_ANCHORED_FIXED_RATIO_THRESHOLD) {
            issues.push({
              ruleId: this.id,
              sceneId,
              severity: 'warning',
              message:
                `under-anchored: syncPoint ${syncPoints.length}개 / action ${actions.length}개 / ` +
                `fixed=${fixedMs}ms (${(ratio * 100).toFixed(0)}% of ${sceneMs}ms 씬) — ` +
                `wait 균등 분배로 teaching action 이 narration 보다 한참 늦을 가능성. teaching action 마다 syncPoint 추가 권장`,
            });
          }
        }
      }
    }

    return issues;
  },
};
