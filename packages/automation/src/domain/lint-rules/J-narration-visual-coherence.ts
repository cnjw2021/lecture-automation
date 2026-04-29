/**
 * 카테고리 J — narration 과 visual 의미 정합성 검증 (#141 옵션 E).
 *
 * 사례 (lecture-02-03 씬 30):
 *   narration: 「サイトが表示されましたね」「画面の上の方に検索バー」
 *   visual: NumberedListScreen (Unsplash 사용법 텍스트 슬라이드)
 *   → 실제 unsplash.com 화면이 떠 있는 전제로 narration 이 쓰였는데 visual 은 추상 슬라이드.
 *      렌더 후 사용자가 직접 확인해야 발견되던 mismatch.
 *
 * 검사 로직:
 *   1) visual.type === 'remotion' 이고 component 가 추상 슬라이드 카테고리에 속함
 *   2) narration 에 시각 의존 표현 (SCREEN_DEICTIC) 검출
 *   → warning 발행 (실제 화면이 필요한지 사람 판정 필요)
 *
 * 보수적 패턴 사용:
 *   - false positive 80% 수준이지만 사람 판정 비용 낮음 (씬당 수 초)
 *   - 진짜 1 건을 렌더 전에 잡는 가치가 큼
 *
 * 향후 확장:
 *   - LLM 기반 의미 정합성 검사 (별도 이슈)
 *   - 패턴 추가는 운영 중 발견 시 점진 추가
 */

import { LintIssue, LintRule } from './types';

/**
 * 추상 슬라이드 컴포넌트 — 실제 브라우저/이미지/Playwright 화면이 아닌 일반 설명 슬라이드.
 * 이 컴포넌트들이 visual 인 경우 narration 의 시각 의존 표현은 mismatch 위험이 있다.
 *
 * 주의: 본 목록에 없는 컴포넌트(BrowserMockScreen, ImageScreen, MyCodeScene 등) 는
 * 실제 시각 자료를 보여주므로 narration 의 화면 지시 표현이 자연스럽다.
 */
const ABSTRACT_SLIDE_COMPONENTS = new Set<string>([
  'TitleScreen',
  'SectionBreakScreen',
  'EndScreen',
  'KeyPointScreen',
  'QuoteScreen',
  'DefinitionScreen',
  'QnAScreen',
  'BulletDetailScreen',
  'TwoColumnScreen',
  'SummaryScreen',
  'NumberedListScreen',
  'IconListScreen',
  'AgendaScreen',
  'ProgressScreen',
  'ComparisonScreen',
  'BeforeAfterScreen',
  'VennDiagramScreen',
  'StatScreen',
  'BarChartScreen',
  'PieChartScreen',
  'DiagramScreen',
  'TimelineScreen',
  'FeatureGridScreen',
  'HierarchyScreen',
  'CalloutScreen',
]);

/**
 * 시각 의존 표현 패턴. 보수적으로 시작 — false positive 최소화.
 *
 * 각 항목: { pattern, hint }
 *   pattern: narration 에서 검색할 정규식
 *   hint: 어떤 화면 요소를 가리키는지 사람 판정용 라벨
 */
const SCREEN_DEICTIC_PATTERNS: { pattern: RegExp; hint: string }[] = [
  { pattern: /表示されまし(?:た|たね)/, hint: '「表示されました」 (실제 페이지/이미지 표시 전제)' },
  // 긴 alternative 를 먼저 — regex 가 좌→우로 매칭하기 때문에 「画面の上の方」 가 「画面の上」 보다 먼저 시도되어야 한다
  { pattern: /画面の(?:右上|右下|上の方|下の方|真ん中|上|下|右|左)/, hint: '「画面の◯◯」 (화면 좌표 지시)' },
  { pattern: /(?:検索|アドレス|ツール|メニュー)バー/, hint: '브라우저/앱 UI 바 지시' },
  { pattern: /(?:右|左)クリックすると/, hint: '조작 결과 묘사' },
  { pattern: /(?:こちら|あちら|ここ|そこ)を(?:見|ご覧)/, hint: '화면 지시어 「ここ/そこ를 보세요」' },
];

export const narrationVisualCoherenceRule: LintRule = {
  id: 'J-narration-visual-coherence',
  description: 'narration 의 시각 의존 표현이 추상 슬라이드 visual 과 어긋나는지 검증',

  run(lecture: any): LintIssue[] {
    const issues: LintIssue[] = [];
    if (!lecture?.sequence || !Array.isArray(lecture.sequence)) return issues;

    for (const scene of lecture.sequence) {
      const sceneId = scene?.scene_id ?? null;
      const visual = scene?.visual;
      if (!visual || visual.type !== 'remotion') continue;
      if (typeof visual.component !== 'string') continue;
      if (!ABSTRACT_SLIDE_COMPONENTS.has(visual.component)) continue;

      const narration: string = typeof scene.narration === 'string' ? scene.narration : '';
      if (narration.length === 0) continue;

      const hits: string[] = [];
      for (const { pattern, hint } of SCREEN_DEICTIC_PATTERNS) {
        if (pattern.test(narration)) {
          const match = narration.match(pattern);
          if (match) {
            hits.push(`「${match[0]}」 (${hint})`);
          }
        }
      }
      if (hits.length === 0) continue;

      issues.push({
        ruleId: 'J-narration-visual-coherence',
        sceneId,
        severity: 'warning',
        message:
          `${visual.component} (추상 슬라이드) 인데 narration 에 시각 의존 표현 검출 — ` +
          `${hits.join(', ')}. ` +
          `실제 화면 (Playwright / ImageScreen / BrowserMockScreen) 이 필요한 씬인지 재검토 필요.`,
      });
    }

    return issues;
  },
};
