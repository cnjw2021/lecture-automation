import * as path from 'path';
import {
  PlaywrightActionHandler,
  CaptureContext,
  RecordContext,
  OffscreenContext,
} from '../../../domain/playwright/PlaywrightActionHandler';
import { estimatePlaywrightActionDurationMs } from '../../../domain/playwright/ActionTiming';

const DEFAULT_WAIT_FOR_TIMEOUT_MS = 30000;

export const waitForHandler: PlaywrightActionHandler = {
  cmd: 'wait_for',
  estimateDurationMs: estimatePlaywrightActionDurationMs,

  async executeForCapture(page, action, ctx: CaptureContext) {
    if (!action.selector) return null;
    const screenshotName = `step-${ctx.stepIndex}.png`;
    const screenshotPath = path.join(ctx.outputDir, screenshotName);
    const state = action.state ?? 'visible';
    const timeout = action.timeout ?? DEFAULT_WAIT_FOR_TIMEOUT_MS;
    const startedAt = Date.now();
    try {
      await page.locator(action.selector).waitFor({ state, timeout });
    } catch (err: any) {
      console.warn(`  ⚠️ wait_for 타임아웃 (${action.selector}): ${err.message}`);
    }
    const elapsed = Date.now() - startedAt;
    await page.screenshot({ path: screenshotPath });
    return {
      index: ctx.stepIndex,
      cmd: 'wait_for',
      screenshot: screenshotName,
      cursorFrom: ctx.cursorPos,
      cursorTo: ctx.cursorPos,
      durationMs: Math.max(elapsed, 500),
      note: action.note,
    };
  },

  async executeForRecording(page, action, _ctx: RecordContext) {
    if (!action.selector) return;
    const state = action.state ?? 'visible';
    const timeout = action.timeout ?? DEFAULT_WAIT_FOR_TIMEOUT_MS;
    console.log(`  > wait_for: "${action.selector}" (${state}, ${timeout}ms)`);
    await page.locator(action.selector).waitFor({ state, timeout });
  },

  async executeOffscreen(page, action, _ctx: OffscreenContext) {
    if (!action.selector) return;
    const state = action.state ?? 'visible';
    const timeout = action.timeout ?? DEFAULT_WAIT_FOR_TIMEOUT_MS;
    // timeout = 페이지 상태 불확실 → 항상 throw (swallow 금지)
    await page.locator(action.selector).waitFor({ state, timeout });
  },
};
