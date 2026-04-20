/**
 * 카테고리 E — 나레이션 길이 vs durationSec 정합.
 *
 * 검증 목적: 작성자가 실수로 durationSec 를 너무 짧게 설정해서
 *           TTS 가 durationSec 를 초과해 잘리는 사고를 방지.
 *
 * 측정 기준:
 *   - 실측 ElevenLabs v3 일본어 평균 ≈ 7자/초.
 *   - 기존 운영 강의(lecture-01-02 등)에서 최대 ~10.8자/초까지 정상 동작 확인.
 *   - 안전 한계 = 11자/초 (이보다 빠르면 TTS 가 잘릴 위험 큼).
 *   - 즉 narration.length / 11 > durationSec 면 위험.
 *
 * 검증 제외:
 *   - Playwright 씬: 일반 씬은 syncPoints 로 wait 가 재계산됨; 라이브 데모(wait_for) 씬은 비디오 길이에 맞춰짐.
 *   - 코드 씬 (MyCodeScene, CodeWalkthroughScreen): 타이핑 + 읽기 시간 추가됨.
 *   - screenshot 씬: 캡처 표시 + 설명 시간이 따로 있음.
 *
 * 의도적인 "긴 여백" 은 검증하지 않음 (TitleScreen 등은 narration 보다 길어도 자연스러움).
 *
 * severity: warning (자동 수정 불가, 작성자 수동 조정).
 */

import { LintIssue, LintRule } from './types';

/** TTS 안전 한계 — 이보다 빠르게 읽혀야 한다고 가정하면 잘릴 위험. */
const SAFETY_LIMIT_CHARS_PER_SEC = 11;

const EXEMPT_COMPONENTS = new Set([
  'MyCodeScene',
  'CodeWalkthroughScreen',
]);

export const narrationLengthRule: LintRule = {
  id: 'E-narration-length',
  description: 'durationSec 가 너무 짧아 TTS 가 잘릴 위험 검출 (안전 한계: 11자/초)',

  run(lecture: any): LintIssue[] {
    const issues: LintIssue[] = [];
    if (!lecture?.sequence || !Array.isArray(lecture.sequence)) return issues;

    for (const scene of lecture.sequence) {
      const visual = scene?.visual;
      if (!visual) continue;

      // 제외 대상
      if (visual.type === 'playwright' || visual.type === 'screenshot') continue;
      if (visual.type === 'remotion' && EXEMPT_COMPONENTS.has(visual.component)) continue;

      const narration: string = typeof scene.narration === 'string' ? scene.narration : '';
      const durationSec: unknown = scene.durationSec;
      if (typeof durationSec !== 'number' || durationSec <= 0) continue;
      if (narration.length === 0) continue;

      const minSafeSec = narration.length / SAFETY_LIMIT_CHARS_PER_SEC;
      if (durationSec < minSafeSec) {
        const actualRate = (narration.length / durationSec).toFixed(1);
        issues.push({
          ruleId: this.id,
          sceneId: scene.scene_id ?? null,
          severity: 'warning',
          message: `나레이션 ${narration.length}자, durationSec ${durationSec}초 → ${actualRate}자/초 필요 (안전 한계 ${SAFETY_LIMIT_CHARS_PER_SEC}자/초 초과). TTS 가 잘릴 위험. durationSec 를 ${Math.ceil(minSafeSec)}초 이상으로 늘릴 것.`,
        });
      }
    }

    return issues;
  },
};
