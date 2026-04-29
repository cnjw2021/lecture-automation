import * as path from 'path';
import {
  PlaywrightActionHandler,
  CaptureContext,
  RecordContext,
  OffscreenContext,
} from '../../../domain/playwright/PlaywrightActionHandler';
import { estimatePlaywrightActionDurationMs } from '../../../domain/playwright/ActionTiming';

export const pressHandler: PlaywrightActionHandler = {
  cmd: 'press',
  estimateDurationMs: estimatePlaywrightActionDurationMs,

  async executeForCapture(page, action, ctx: CaptureContext) {
    if (!action.key) return null;
    const screenshotName = `step-${ctx.stepIndex}.png`;
    const screenshotPath = path.join(ctx.outputDir, screenshotName);
    await page.screenshot({ path: screenshotPath });
    await page.keyboard.press(action.key);
    return {
      index: ctx.stepIndex,
      cmd: 'press',
      screenshot: screenshotName,
      cursorFrom: ctx.cursorPos,
      cursorTo: ctx.cursorPos,
      durationMs: 300,
      note: action.note,
    };
  },

  async executeForRecording(page, action, _ctx: RecordContext) {
    if (action.key) await page.keyboard.press(action.key);
  },

  async executeOffscreen(page, action, _ctx: OffscreenContext) {
    if (action.key) await page.keyboard.press(action.key);
  },
};
