import * as path from 'path';
import {
  PlaywrightActionHandler,
  CaptureContext,
  RecordContext,
  OffscreenContext,
} from '../../../domain/playwright/PlaywrightActionHandler';
import { estimatePlaywrightActionDurationMs } from '../../../domain/playwright/ActionTiming';

const DEFAULT_DELTA_Y = 300;
const SETTLE_MS = 300;

export const scrollHandler: PlaywrightActionHandler = {
  cmd: 'scroll',
  estimateDurationMs: estimatePlaywrightActionDurationMs,

  async executeForCapture(page, action, ctx: CaptureContext) {
    const screenshotName = `step-${ctx.stepIndex}.png`;
    const screenshotPath = path.join(ctx.outputDir, screenshotName);
    const deltaY = action.deltaY ?? DEFAULT_DELTA_Y;
    await page.mouse.wheel(0, deltaY);
    await page.waitForTimeout(SETTLE_MS);
    await page.screenshot({ path: screenshotPath });
    return {
      index: ctx.stepIndex,
      cmd: 'scroll',
      screenshot: screenshotName,
      cursorFrom: ctx.cursorPos,
      cursorTo: ctx.cursorPos,
      durationMs: 500,
      note: action.note,
    };
  },

  async executeForRecording(page, action, _ctx: RecordContext) {
    await page.mouse.wheel(0, action.deltaY ?? DEFAULT_DELTA_Y);
    await page.waitForTimeout(SETTLE_MS);
  },

  async executeOffscreen(page, action, _ctx: OffscreenContext) {
    await page.mouse.wheel(0, action.deltaY ?? DEFAULT_DELTA_Y);
    await page.waitForTimeout(SETTLE_MS);
  },
};
