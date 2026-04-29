import { LintRule } from './types';
import { ttsLandminesRule } from './A-tts-landmines';
import { symbolViolationsRule } from './B-symbol-violations';
import { playwrightShapeRule } from './D-playwright-shape';
import { narrationLengthRule } from './E-narration-length';
import { playwrightTimingRule } from './F-playwright-timing';
import { playwrightSyncCoverageRule } from './G-playwright-sync-coverage';
import { captureePlaceholderRule } from './H-capture-placeholder';

export * from './types';

/**
 * 활성 룰 목록. 신규 룰 추가 시 여기에 등록.
 *
 * 활성: A (TTS 지뢰), B (기호 위반), D (Playwright shape), E (나레이션 정합),
 *      F (Playwright timing), G (Playwright sync coverage), H (capture placeholder)
 * 향후: C (영어 용어 — false-positive 위험으로 보류)
 */
export const allRules: LintRule[] = [
  ttsLandminesRule,
  symbolViolationsRule,
  playwrightShapeRule,
  narrationLengthRule,
  playwrightTimingRule,
  playwrightSyncCoverageRule,
  captureePlaceholderRule,
];
