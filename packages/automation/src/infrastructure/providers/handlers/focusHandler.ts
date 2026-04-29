import * as path from 'path';
import {
  PlaywrightActionHandler,
  CaptureContext,
  RecordContext,
  OffscreenContext,
} from '../../../domain/playwright/PlaywrightActionHandler';
import { estimatePlaywrightActionDurationMs } from '../../../domain/playwright/ActionTiming';

const FOCUS_LOCATOR_TIMEOUT_MS = 10000;

export const focusHandler: PlaywrightActionHandler = {
  cmd: 'focus',
  estimateDurationMs: estimatePlaywrightActionDurationMs,

  async executeForCapture(page, action, ctx: CaptureContext) {
    if (!action.selector) return null;
    const screenshotName = `step-${ctx.stepIndex}.png`;
    const screenshotPath = path.join(ctx.outputDir, screenshotName);
    const loc = page.locator(action.selector);
    await loc.waitFor({ state: 'visible', timeout: FOCUS_LOCATOR_TIMEOUT_MS });
    const box = await loc.boundingBox();
    await page.screenshot({ path: screenshotPath });
    await loc.focus();
    return {
      index: ctx.stepIndex,
      cmd: 'focus',
      screenshot: screenshotName,
      cursorFrom: ctx.cursorPos,
      cursorTo: box
        ? { x: box.x + box.width / 2, y: box.y + box.height / 2 }
        : ctx.cursorPos,
      targetBox: box ? { x: box.x, y: box.y, width: box.width, height: box.height } : undefined,
      durationMs: 300,
      note: action.note,
    };
  },

  async executeForRecording(page, action, _ctx: RecordContext) {
    if (!action.selector) return;
    const loc = page.locator(action.selector);
    await loc.waitFor({ state: 'visible', timeout: FOCUS_LOCATOR_TIMEOUT_MS });
    await loc.focus();
  },

  async executeOffscreen(page, action, _ctx: OffscreenContext) {
    if (!action.selector) return;
    const loc = page.locator(action.selector);
    await loc.waitFor({ state: 'visible', timeout: FOCUS_LOCATOR_TIMEOUT_MS });
    await loc.focus();
  },
};
