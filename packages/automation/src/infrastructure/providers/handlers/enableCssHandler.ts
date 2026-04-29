import * as path from 'path';
import {
  PlaywrightActionHandler,
  CaptureContext,
  RecordContext,
  OffscreenContext,
} from '../../../domain/playwright/PlaywrightActionHandler';
import { estimatePlaywrightActionDurationMs } from '../../../domain/playwright/ActionTiming';

const CAPTURE_SETTLE_MS = 200;
const RECORDING_SETTLE_MS = 300;

async function enableAllStylesheets(page: any): Promise<void> {
  await page.evaluate(() => {
    Array.from(document.styleSheets).forEach(sheet => {
      try { sheet.disabled = false; } catch (_) {}
    });
  });
}

export const enableCssHandler: PlaywrightActionHandler = {
  cmd: 'enable_css',
  estimateDurationMs: estimatePlaywrightActionDurationMs,

  async executeForCapture(page, action, ctx: CaptureContext) {
    const screenshotName = `step-${ctx.stepIndex}.png`;
    const screenshotPath = path.join(ctx.outputDir, screenshotName);
    await enableAllStylesheets(page);
    await page.waitForTimeout(CAPTURE_SETTLE_MS);
    await page.screenshot({ path: screenshotPath });
    return {
      index: ctx.stepIndex,
      cmd: 'enable_css',
      screenshot: screenshotName,
      cursorFrom: ctx.cursorPos,
      cursorTo: ctx.cursorPos,
      durationMs: 500,
      note: action.note,
    };
  },

  async executeForRecording(page, _action, _ctx: RecordContext) {
    await enableAllStylesheets(page);
    await page.waitForTimeout(RECORDING_SETTLE_MS);
  },

  async executeOffscreen(page, _action, _ctx: OffscreenContext) {
    await enableAllStylesheets(page);
  },
};
