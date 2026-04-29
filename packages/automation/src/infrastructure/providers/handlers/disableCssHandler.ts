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

async function disableAllStylesheets(page: any): Promise<void> {
  await page.evaluate(() => {
    Array.from(document.styleSheets).forEach(sheet => {
      try {
        const owner = sheet.ownerNode as Element | null;
        if (owner?.id?.startsWith('__edu')) return;
        if (owner?.closest?.('#__edu_devtools__')) return;
        sheet.disabled = true;
      } catch (_) {}
    });
  });
}

export const disableCssHandler: PlaywrightActionHandler = {
  cmd: 'disable_css',
  estimateDurationMs: estimatePlaywrightActionDurationMs,

  async executeForCapture(page, action, ctx: CaptureContext) {
    const screenshotName = `step-${ctx.stepIndex}.png`;
    const screenshotPath = path.join(ctx.outputDir, screenshotName);
    await disableAllStylesheets(page);
    await page.waitForTimeout(CAPTURE_SETTLE_MS);
    await page.screenshot({ path: screenshotPath });
    return {
      index: ctx.stepIndex,
      cmd: 'disable_css',
      screenshot: screenshotName,
      cursorFrom: ctx.cursorPos,
      cursorTo: ctx.cursorPos,
      durationMs: 500,
      note: action.note,
    };
  },

  async executeForRecording(page, _action, _ctx: RecordContext) {
    await disableAllStylesheets(page);
    await page.waitForTimeout(RECORDING_SETTLE_MS);
  },

  async executeOffscreen(page, _action, _ctx: OffscreenContext) {
    await disableAllStylesheets(page);
  },
};
