import { PlaywrightAction } from '../entities/Lecture';
import {
  PLAYWRIGHT_TIMING,
  estimatePlaywrightActionDurationMs,
  estimateFixedActionDurationMs,
  estimateActionsDurationMs,
} from './ActionTiming';

/**
 * #141 F-1 calibration 검증.
 *
 * 캘리브레이션 근거:
 *   - lecture-02-03 의 모든 Playwright 씬에서 webm 녹화가 audio 보다 1~6 초 길게 종료
 *   - 씬 34 의 type 액션 실측 per-char ~107~122ms (평균 ~110ms)
 *   - 기존 100ms 추정은 일관 underestimate
 *   - prefillCodepenMs: 4500 → 5000 (실측 ~4761ms)
 */
describe('PLAYWRIGHT_TIMING (F-1 calibration)', () => {
  it('typeDelayMsPerChar 는 실측 평균 110ms 로 상향됨', () => {
    expect(PLAYWRIGHT_TIMING.typeDelayMsPerChar).toBe(110);
  });

  it('prefillCodepenMs 는 실측 평균 5000ms 로 상향됨', () => {
    expect(PLAYWRIGHT_TIMING.prefillCodepenMs).toBe(5000);
  });
});

describe('estimatePlaywrightActionDurationMs', () => {
  it('type 액션은 char count × 110ms 로 추산된다', () => {
    const action: PlaywrightAction = { cmd: 'type', selector: '#a', key: 'hello' } as any;
    const result = estimatePlaywrightActionDurationMs(action);
    expect(result.ms).toBe(5 * 110);
    expect(result.basis).toContain('5 chars');
    expect(result.basis).toContain('110ms');
  });

  it('빈 type 키는 0ms', () => {
    const action: PlaywrightAction = { cmd: 'type', selector: '#a', key: '' } as any;
    expect(estimatePlaywrightActionDurationMs(action).ms).toBe(0);
  });

  it('prefill_codepen 은 5000ms', () => {
    const action: PlaywrightAction = { cmd: 'prefill_codepen', html: '<div/>' } as any;
    expect(estimatePlaywrightActionDurationMs(action).ms).toBe(5000);
  });

  it('offscreen 액션은 0ms', () => {
    const action: PlaywrightAction = { cmd: 'type', selector: '#a', key: 'hello', offscreen: true } as any;
    expect(estimatePlaywrightActionDurationMs(action).ms).toBe(0);
  });

  it('mouse_move 800ms / click 500ms / press 100ms 유지', () => {
    expect(estimatePlaywrightActionDurationMs({ cmd: 'mouse_move' } as any).ms).toBe(800);
    expect(estimatePlaywrightActionDurationMs({ cmd: 'click', selector: '#a' } as any).ms).toBe(500);
    expect(estimatePlaywrightActionDurationMs({ cmd: 'press', key: 'Enter' } as any).ms).toBe(100);
  });
});

describe('estimateFixedActionDurationMs', () => {
  it('wait 액션은 0ms (조정 가능)', () => {
    const action: PlaywrightAction = { cmd: 'wait', ms: 2000 } as any;
    expect(estimateFixedActionDurationMs(action).ms).toBe(0);
  });
});

describe('estimateActionsDurationMs', () => {
  it('wait 제외 합산 (기본)', () => {
    const actions: PlaywrightAction[] = [
      { cmd: 'click', selector: '#a' },
      { cmd: 'wait', ms: 2000 },
      { cmd: 'type', selector: '#a', key: 'abc' },
    ] as any;
    // click 500 + type 3*110 = 830
    expect(estimateActionsDurationMs(actions)).toBe(500 + 330);
  });

  it('wait 포함 합산 (includeWait)', () => {
    const actions: PlaywrightAction[] = [
      { cmd: 'click', selector: '#a' },
      { cmd: 'wait', ms: 2000 },
      { cmd: 'type', selector: '#a', key: 'abc' },
    ] as any;
    expect(estimateActionsDurationMs(actions, { includeWait: true })).toBe(500 + 2000 + 330);
  });

  it('offscreen 액션은 항상 제외', () => {
    const actions: PlaywrightAction[] = [
      { cmd: 'click', selector: '#a', offscreen: true },
      { cmd: 'type', selector: '#a', key: 'hello' },
    ] as any;
    expect(estimateActionsDurationMs(actions)).toBe(5 * 110);
  });
});
