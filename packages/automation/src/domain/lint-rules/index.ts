import { LintRule } from './types';
import { ttsLandminesRule } from './A-tts-landmines';
import { symbolViolationsRule } from './B-symbol-violations';

export * from './types';

/**
 * 활성 룰 목록. 신규 룰 추가 시 여기에 등록.
 *
 * MVP: 카테고리 A (TTS 지뢰) + B (기호 위반)
 * 향후: C (영어 용어), D (Playwright shape), E (나레이션 정합)
 */
export const allRules: LintRule[] = [
  ttsLandminesRule,
  symbolViolationsRule,
];
