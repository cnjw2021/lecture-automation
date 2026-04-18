import { Lecture, PlaywrightVisual, Scene } from '../entities/Lecture';
import { isSharedSessionScene, planLiveDemoSessions } from './LiveDemoScenePolicy';

/**
 * shared session (P-D) 씬의 구조적 제약을 검증한다 (순수 함수).
 *
 * 검증 규칙:
 *  R1. shared session 씬의 모든 action 에서 urlFromScene 사용 금지
 *      shared 는 같은 page 인스턴스 재사용이므로 URL 재참조라는 개념 자체가 없다.
 *  R2. shared session **결과 확인 씬**(세션 그룹 내 2번째 이후)의
 *      모든 action(offscreen 포함)에서 goto 금지.
 *      offscreen goto 도 page 를 교체하므로 공유 page 상태를 파괴한다.
 *      결과 확인 씬은 재진입이 아니라 이전 씬의 page 를 이어받아야 한다.
 *  R3. shared session 씬 전체에서 render_code_block 금지
 *      render_code_block 은 about:blank 이동 후 setContent()로 page 를 완전히 교체하므로
 *      후속 씬이 잘못된 DOM 에서 시작하게 된다.
 *  R4. shared session 씬의 syncPoints.actionIndex 는 visible(=offscreen 이 아닌) action 을
 *      가리켜야 한다. offscreen 은 클립 타임라인 바깥에서 실행되므로 순방향 싱크의
 *      세그먼트 피벗으로 삼으면 세그먼트 경계가 깨진다. 또한 actionIndex 는 범위
 *      ([0, action.length)) 안이어야 한다.
 *
 * 세션 그룹 내 첫 씬(entry scene)은 goto 로 시작해도 된다.
 * 단 R3 는 entry/continuation 구분 없이 전체 금지.
 */

export interface SharedSessionViolation {
  sceneId: number;
  rule:
    | 'shared-session-no-url-from-scene'
    | 'shared-session-no-goto-on-continuation'
    | 'shared-session-no-render-code-block'
    | 'shared-session-sync-point-on-offscreen'
    | 'shared-session-sync-point-out-of-range';
  actionIndex?: number;
  message: string;
}

export function validateSharedSessions(lecture: Lecture): SharedSessionViolation[] {
  const violations: SharedSessionViolation[] = [];
  const sceneById = new Map<number, Scene>();
  for (const scene of lecture.sequence) sceneById.set(scene.scene_id, scene);

  const groups = planLiveDemoSessions(lecture);

  for (const group of groups) {
    for (let groupIdx = 0; groupIdx < group.sceneIds.length; groupIdx++) {
      const sceneId = group.sceneIds[groupIdx];
      const scene = sceneById.get(sceneId);
      if (!scene || !isSharedSessionScene(scene)) continue;
      const visual = scene.visual as PlaywrightVisual;
      const isEntryScene = groupIdx === 0;

      // R1: urlFromScene 금지
      for (let i = 0; i < visual.action.length; i++) {
        if (typeof visual.action[i].urlFromScene === 'number') {
          violations.push({
            sceneId,
            rule: 'shared-session-no-url-from-scene',
            actionIndex: i,
            message: `shared session 씬(id=${sceneId})의 action[${i}] 에 urlFromScene 사용 불가 — shared 는 page 인스턴스 재사용, URL 재참조 아님`,
          });
        }
      }

      // R3: render_code_block 금지 (about:blank 이동 + setContent로 page를 완전히 교체해
      //     shared session의 후속 씬이 잘못된 DOM에서 시작하게 됨)
      for (let i = 0; i < visual.action.length; i++) {
        if (visual.action[i].cmd === 'render_code_block') {
          violations.push({
            sceneId,
            rule: 'shared-session-no-render-code-block',
            actionIndex: i,
            message: `shared session 씬(id=${sceneId})의 action[${i}] 에 render_code_block 사용 불가 — about:blank 이동으로 공유 page 상태를 파괴함`,
          });
        }
      }

      // R2: 결과 확인 씬의 모든 action(offscreen 포함)에서 goto 금지
      // offscreen goto 도 page 를 교체하므로 shared 설계를 파괴한다
      if (!isEntryScene) {
        for (let i = 0; i < visual.action.length; i++) {
          if (visual.action[i].cmd === 'goto') {
            violations.push({
              sceneId,
              rule: 'shared-session-no-goto-on-continuation',
              actionIndex: i,
              message: `shared session 결과 확인 씬(id=${sceneId})의 action[${i}] 에 goto 사용 불가 (offscreen 포함) — page 이어받기 구조여야 함`,
            });
          }
        }
      }

      // R4: syncPoints.actionIndex 는 범위 내 + visible action 이어야 함
      // offscreen 은 클립 타임라인 바깥이므로 세그먼트 피벗이 되면 순방향 싱크가 파손된다
      if (visual.syncPoints) {
        for (const sp of visual.syncPoints) {
          const idx = sp.actionIndex;
          if (idx < 0 || idx >= visual.action.length) {
            violations.push({
              sceneId,
              rule: 'shared-session-sync-point-out-of-range',
              actionIndex: idx,
              message: `shared session 씬(id=${sceneId})의 syncPoint.actionIndex=${idx} 가 action 배열 범위(0..${visual.action.length - 1}) 밖`,
            });
            continue;
          }
          if (visual.action[idx].offscreen === true) {
            violations.push({
              sceneId,
              rule: 'shared-session-sync-point-on-offscreen',
              actionIndex: idx,
              message: `shared session 씬(id=${sceneId})의 syncPoint.actionIndex=${idx} 가 offscreen action 을 가리킴 — 순방향 싱크 세그먼트 피벗은 visible action 이어야 함`,
            });
          }
        }
      }
    }
  }

  return violations;
}
