/**
 * 카테고리 H — ${capture:key} placeholder 검증.
 *
 * 검출 대상:
 *   H-1. ${capture:key} 가 selector / url / key / html / css / js 외 필드에 사용됨 (검출 대상 외 필드)
 *   H-2. placeholder 가 참조하는 key 를 정의하는 saveAs 가 동일 강의 내 더 앞 씬에 없음
 *        (capture / right_click.captureFromTarget 에서 saveAs 로 정의된 키만 후속 씬에서 사용 가능)
 *   H-3. 자기 자신 씬 안에서 동일 액션의 ${capture} 를 참조 (저장보다 먼저 사용)
 */

import { LintIssue, LintRule } from './types';

const EXPANDABLE_FIELDS = new Set<string>(['url', 'selector', 'key', 'html', 'css', 'js']);
const PLACEHOLDER_PATTERN = /\$\{capture:([a-zA-Z0-9_-]+)\}/g;

interface SaveAsOccurrence {
  sceneId: number | null;
  sceneIndex: number;
  actionIndex: number;
}

export const captureePlaceholderRule: LintRule = {
  id: 'H-capture-placeholder',
  description: '${capture:key} placeholder 가 유효한 saveAs 로 정의되어 있는지 검증',

  run(lecture: any): LintIssue[] {
    const issues: LintIssue[] = [];
    if (!lecture?.sequence || !Array.isArray(lecture.sequence)) return issues;

    // 1) 강의 내 saveAs 정의 위치 인덱싱 (capture / right_click.captureFromTarget)
    const saveAsMap = new Map<string, SaveAsOccurrence>();
    lecture.sequence.forEach((scene: any, sceneIndex: number) => {
      const visual = scene?.visual;
      if (!visual || visual.type !== 'playwright') return;
      const actions = Array.isArray(visual.action) ? visual.action : [];
      const sceneId = scene?.scene_id ?? null;
      actions.forEach((act: any, actionIndex: number) => {
        if (!act || typeof act !== 'object') return;
        const saveAs =
          act.cmd === 'capture'
            ? act.saveAs
            : act.cmd === 'right_click'
              ? act.captureFromTarget?.saveAs
              : undefined;
        if (typeof saveAs === 'string' && saveAs.length > 0 && !saveAsMap.has(saveAs)) {
          saveAsMap.set(saveAs, { sceneId, sceneIndex, actionIndex });
        }
      });
    });

    // 2) placeholder 사용처 검사
    lecture.sequence.forEach((scene: any, sceneIndex: number) => {
      const visual = scene?.visual;
      if (!visual || visual.type !== 'playwright') return;
      const actions = Array.isArray(visual.action) ? visual.action : [];
      const sceneId = scene?.scene_id ?? null;

      actions.forEach((act: any, actionIndex: number) => {
        if (!act || typeof act !== 'object') return;
        for (const [field, value] of Object.entries(act)) {
          if (typeof value !== 'string') continue;
          if (!value.includes('${capture:')) continue;

          if (!EXPANDABLE_FIELDS.has(field)) {
            issues.push({
              ruleId: 'H-capture-placeholder',
              sceneId,
              severity: 'error',
              message: `action[${actionIndex}].${field} 에 \${capture:...} 가 있지만 placeholder 치환 대상 필드가 아닙니다 (대상: ${[...EXPANDABLE_FIELDS].join(', ')})`,
              context: value.slice(0, 80),
            });
            continue;
          }

          PLACEHOLDER_PATTERN.lastIndex = 0;
          let match: RegExpExecArray | null;
          while ((match = PLACEHOLDER_PATTERN.exec(value)) !== null) {
            const key = match[1];
            const def = saveAsMap.get(key);
            if (!def) {
              issues.push({
                ruleId: 'H-capture-placeholder',
                sceneId,
                severity: 'error',
                message: `\${capture:${key}} 가 사용되었지만 어떤 capture / right_click.captureFromTarget 도 saveAs="${key}" 로 정의하지 않습니다`,
                context: value.slice(0, 80),
              });
              continue;
            }
            // H-3: 같은 씬·이전 액션 또는 더 앞 씬에서 정의되어야 함
            const isBeforeInSequence =
              def.sceneIndex < sceneIndex ||
              (def.sceneIndex === sceneIndex && def.actionIndex < actionIndex);
            if (!isBeforeInSequence) {
              issues.push({
                ruleId: 'H-capture-placeholder',
                sceneId,
                severity: 'error',
                message: `\${capture:${key}} 가 사용되는 위치(scene ${sceneId}, action[${actionIndex}]) 보다 saveAs 정의가 뒤에 있습니다 (정의: scene ${def.sceneId}, action[${def.actionIndex}])`,
                context: value.slice(0, 80),
              });
            }
          }
        }
      });
    });

    return issues;
  },
};
