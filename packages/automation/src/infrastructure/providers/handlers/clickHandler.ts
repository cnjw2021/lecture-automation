import * as path from 'path';
import {
  PlaywrightActionHandler,
  CaptureContext,
  RecordContext,
  OffscreenContext,
} from '../../../domain/playwright/PlaywrightActionHandler';
import { CursorPosition } from '../../../domain/entities/StepManifest';
import { estimatePlaywrightActionDurationMs } from '../../../domain/playwright/ActionTiming';

const CLICK_TIMEOUT_MS = 10000;

export const clickHandler: PlaywrightActionHandler = {
  cmd: 'click',
  estimateDurationMs: estimatePlaywrightActionDurationMs,

  async executeForCapture(page, action, ctx: CaptureContext) {
    if (!action.selector) return null;
    const screenshotName = `step-${ctx.stepIndex}.png`;
    const screenshotPath = path.join(ctx.outputDir, screenshotName);
    const loc = page.locator(action.selector);
    await loc.waitFor({ state: 'visible', timeout: CLICK_TIMEOUT_MS });
    const box = await loc.boundingBox();
    await page.screenshot({ path: screenshotPath });
    const target: CursorPosition = box
      ? { x: box.x + box.width / 2, y: box.y + box.height / 2 }
      : ctx.cursorPos;
    await loc.click({ timeout: CLICK_TIMEOUT_MS });
    return {
      index: ctx.stepIndex,
      cmd: 'click',
      screenshot: screenshotName,
      cursorFrom: ctx.cursorPos,
      cursorTo: target,
      targetBox: box ? { x: box.x, y: box.y, width: box.width, height: box.height } : undefined,
      durationMs: 500,
      isClick: true,
      note: action.note,
    };
  },

  async executeForRecording(page, action, _ctx: RecordContext) {
    if (!action.selector) return;
    await page.locator(action.selector).click({ timeout: CLICK_TIMEOUT_MS });
  },

  async executeOffscreen(page, action, _ctx: OffscreenContext) {
    if (!action.selector) return;
    await page.locator(action.selector).click({ timeout: CLICK_TIMEOUT_MS });
  },
};
