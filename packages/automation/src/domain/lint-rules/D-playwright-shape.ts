/**
 * 카테고리 D — Playwright 씬 구조 검증.
 *
 * 검출 대상 (모두 결정론적, false-positive 거의 없음):
 *   D-1. action 배열의 각 요소가 `{cmd: "..."}` 형식인지
 *        — 잘못된 예: `{"goto": "url"}` (action 인식 실패)
 *   D-2. cmd 가 정의된 PlaywrightCmd 유니온 안의 값인지
 *   D-3. syncPoints[i].actionIndex 가 action 배열 범위 내인지
 *   D-4. syncPoints[i].phrase 가 narration 안에 실제 포함되어 있는지 (substring)
 *   D-5. syncPoints[i].phrase 가 narration 안에 unique 한지 (중복 매칭 시 sync 위치 모호)
 *
 * 모두 error severity. 자동 수정 불가 (작성자 수동 수정 필요).
 */

import { LintIssue, LintRule } from './types';

const VALID_CMDS = new Set([
  'goto',
  'wait',
  'wait_for',
  'scroll',
  'mouse_move',
  'click',
  'type',
  'press',
  'focus',
  'mouse_drag',
  'highlight',
  'open_devtools',
  'select_devtools_node',
  'toggle_devtools_node',
  'disable_css',
  'enable_css',
  'render_code_block',
  'wait_for_claude_ready',
  'prefill_codepen',
  'right_click',
  'capture',
]);

export const playwrightShapeRule: LintRule = {
  id: 'D-playwright-shape',
  description: 'Playwright 씬 action/syncPoints 구조 검증 (cmd 형식, syncPoints phrase 매칭 등)',

  run(lecture: any): LintIssue[] {
    const issues: LintIssue[] = [];
    if (!lecture?.sequence || !Array.isArray(lecture.sequence)) return issues;

    for (const scene of lecture.sequence) {
      const visual = scene?.visual;
      if (!visual || visual.type !== 'playwright') continue;

      const sceneId = scene.scene_id ?? null;
      const narration: string = typeof scene.narration === 'string' ? scene.narration : '';
      const actions = Array.isArray(visual.action) ? visual.action : [];

      // D-1, D-2: action 형식 / cmd 유효성
      actions.forEach((act: any, i: number) => {
        if (!act || typeof act !== 'object') {
          issues.push({
            ruleId: this.id,
            sceneId,
            severity: 'error',
            message: `action[${i}] 가 객체가 아님 — Playwright 액션은 ${`{cmd: "..."}`} 형식이어야 함`,
          });
          return;
        }
        if (typeof act.cmd !== 'string') {
          // 잘못된 형식 ({"goto": "url"} 같은 경우): cmd 키가 없고 다른 키만 있음
          const altKeys = Object.keys(act).filter(k => VALID_CMDS.has(k));
          const hint = altKeys.length > 0
            ? ` — 「${altKeys[0]}」 가 키로 사용됨. 「{"cmd": "${altKeys[0]}", ...}」 형식으로 수정 필요`
            : '';
          issues.push({
            ruleId: this.id,
            sceneId,
            severity: 'error',
            message: `action[${i}] 에 cmd 필드 없음${hint}`,
          });
          return;
        }
        if (!VALID_CMDS.has(act.cmd)) {
          issues.push({
            ruleId: this.id,
            sceneId,
            severity: 'error',
            message: `action[${i}] cmd「${act.cmd}」 는 정의되지 않은 액션. 유효 cmd: docs/playwright-actions.md 참조`,
          });
        }
      });

      // D-3, D-4, D-5: syncPoints
      const syncPoints = Array.isArray(visual.syncPoints) ? visual.syncPoints : [];
      syncPoints.forEach((sp: any, i: number) => {
        if (!sp || typeof sp !== 'object') return;

        const idx = sp.actionIndex;
        if (typeof idx !== 'number' || !Number.isInteger(idx) || idx < 0 || idx >= actions.length) {
          const reason = typeof idx === 'number' && !Number.isInteger(idx)
            ? '정수가 아님'
            : `action 배열 범위 밖 (총 ${actions.length}개)`;
          issues.push({
            ruleId: this.id,
            sceneId,
            severity: 'error',
            message: `syncPoints[${i}].actionIndex=${idx} ${reason}`,
          });
          return;
        }

        const phrase = sp.phrase;
        if (typeof phrase !== 'string' || phrase.length === 0) {
          issues.push({
            ruleId: this.id,
            sceneId,
            severity: 'error',
            message: `syncPoints[${i}].phrase 가 비어있음 (actionIndex=${idx})`,
          });
          return;
        }

        // D-4: narration 안에 phrase 포함 여부
        if (!narration.includes(phrase)) {
          issues.push({
            ruleId: this.id,
            sceneId,
            severity: 'error',
            message: `syncPoints[${i}].phrase「${phrase}」 가 narration 안에 없음 — sync 불가`,
          });
          return;
        }

        // D-5: 유일성
        const occurrences = narration.split(phrase).length - 1;
        if (occurrences > 1) {
          issues.push({
            ruleId: this.id,
            sceneId,
            severity: 'error',
            message: `syncPoints[${i}].phrase「${phrase}」 가 narration 안에 ${occurrences}회 등장 — 유일하게 식별되도록 더 긴 부분문자열로 변경 필요`,
          });
        }
      });
    }

    return issues;
  },
};
