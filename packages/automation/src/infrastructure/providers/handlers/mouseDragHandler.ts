import * as path from 'path';
import {
  PlaywrightActionHandler,
  CaptureContext,
  RecordContext,
  OffscreenContext,
} from '../../../domain/playwright/PlaywrightActionHandler';
import { estimatePlaywrightActionDurationMs } from '../../../domain/playwright/ActionTiming';

const DRAG_STEPS = 10;

async function drag(page: any, from: [number, number], to: [number, number]): Promise<void> {
  await page.mouse.move(from[0], from[1]);
  await page.mouse.down();
  await page.mouse.move(to[0], to[1], { steps: DRAG_STEPS });
  await page.mouse.up();
}

export const mouseDragHandler: PlaywrightActionHandler = {
  cmd: 'mouse_drag',
  estimateDurationMs: estimatePlaywrightActionDurationMs,

  async executeForCapture(page, action, ctx: CaptureContext) {
    if (!action.from || !action.to) return null;
    const screenshotName = `step-${ctx.stepIndex}.png`;
    const screenshotPath = path.join(ctx.outputDir, screenshotName);
    await page.screenshot({ path: screenshotPath });
    await drag(page, action.from, action.to);
    return {
      index: ctx.stepIndex,
      cmd: 'mouse_drag',
      screenshot: screenshotName,
      cursorFrom: { x: action.from[0], y: action.from[1] },
      cursorTo: { x: action.to[0], y: action.to[1] },
      durationMs: 800,
      note: action.note,
    };
  },

  async executeForRecording(page, action, _ctx: RecordContext) {
    if (!action.from || !action.to) return;
    await drag(page, action.from, action.to);
  },

  async executeOffscreen(page, action, _ctx: OffscreenContext) {
    if (!action.from || !action.to) return;
    await drag(page, action.from, action.to);
  },
};
