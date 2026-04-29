import { AsyncLintRule, LintRule } from './types';
import { ttsLandminesRule } from './A-tts-landmines';
import { symbolViolationsRule } from './B-symbol-violations';
import { playwrightShapeRule } from './D-playwright-shape';
import { narrationLengthRule } from './E-narration-length';
import { playwrightTimingRule } from './F-playwright-timing';
import { playwrightSyncCoverageRule } from './G-playwright-sync-coverage';
import { captureePlaceholderRule } from './H-capture-placeholder';
import { audioNarrationCoherenceRule } from './I-audio-narration-coherence';

export * from './types';

/**
 * 동기 룰 목록. 신규 동기 룰 추가 시 여기에 등록.
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

/**
 * 외부 자원(파일 시스템 등) 을 읽어야 하는 비동기 룰 목록.
 *
 * 활성: I (audio/narration coherence — alignment.json 비교)
 */
export const asyncRules: AsyncLintRule[] = [
  audioNarrationCoherenceRule,
];
