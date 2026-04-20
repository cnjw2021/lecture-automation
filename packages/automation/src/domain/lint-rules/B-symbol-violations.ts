/**
 * 카테고리 B — 기호 위반 (json-conversion-rules.md 「ナレーション作成ルール」 기반).
 *
 * - `——` (em 대시): TTS가 "マイナス" 로 읽음. 접속표현으로 대체 필요. (자동 수정 불가 — 문맥 의존)
 * - `（…）` 부가 설명 괄호: TTS가 괄호 내용까지 읽어 부자연스러움. (자동 수정 불가 — 문맥 의존)
 *
 * 둘 다 경고만 발생시키고 사용자가 수동 수정한다.
 *
 * 예외:
 *   - 일본어 인용 「」 안의 괄호는 검출 대상에서 제외 (예: 「Apple（アップル）」 같은 화면 내 표시 인용)
 *     → 단순화를 위해 현재는 모든 （…） 를 경고하되, 향후 화이트리스트 추가 가능.
 */

import { LintIssue, LintRule } from './types';

export const symbolViolationsRule: LintRule = {
  id: 'B-symbol-violations',
  description: '나레이션의 금지 기호 검출 (—— em 대시, （…）  부가 설명 괄호)',

  run(lecture: any): LintIssue[] {
    const issues: LintIssue[] = [];
    if (!lecture?.sequence || !Array.isArray(lecture.sequence)) return issues;

    lecture.sequence.forEach((scene: any) => {
      const narration: string = typeof scene?.narration === 'string' ? scene.narration : '';
      if (!narration) return;

      // em 대시: U+2014 가 두 개 연속 (——). 단일도 위험하지만 흔히 두 개 연속으로 쓰임.
      const emDashMatches = narration.match(/—{2,}/g) || narration.match(/—/g);
      if (emDashMatches && emDashMatches.length > 0) {
        issues.push({
          ruleId: this.id,
          sceneId: scene.scene_id ?? null,
          severity: 'error',
          message: `em 대시「—」 ${emDashMatches.length}회 — TTS가 "マイナス" 로 읽음. 「、つまり」「、たとえば」 등 접속표현으로 대체`,
          context: extractContext(narration, '—'),
        });
      }

      // 부가 설명 괄호: 일본어 전각 괄호 （…）
      // 빈 괄호 （） 는 제외, 내용이 있는 것만
      const parenMatches = [...narration.matchAll(/（[^）]+）/g)];
      if (parenMatches.length > 0) {
        const samples = parenMatches.slice(0, 3).map(m => m[0]).join(', ');
        issues.push({
          ruleId: this.id,
          sceneId: scene.scene_id ?? null,
          severity: 'warning',
          message: `부가 설명 괄호「（…）」 ${parenMatches.length}회 — TTS가 내용까지 읽음. 접속표현으로 대체 검토. 예: ${samples}`,
        });
      }
    });

    return issues;
  },
};

function extractContext(text: string, needle: string): string {
  const idx = text.indexOf(needle);
  if (idx === -1) return '';
  const start = Math.max(0, idx - 15);
  const end = Math.min(text.length, idx + needle.length + 15);
  const prefix = start > 0 ? '…' : '';
  const suffix = end < text.length ? '…' : '';
  return `${prefix}${text.slice(start, end)}${suffix}`;
}
