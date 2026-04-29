import * as path from 'path';
import {
  PlaywrightActionHandler,
  CaptureContext,
  RecordContext,
  OffscreenContext,
} from '../../../domain/playwright/PlaywrightActionHandler';
import { CursorPosition } from '../../../domain/entities/StepManifest';
import { estimatePlaywrightActionDurationMs } from '../../../domain/playwright/ActionTiming';

const MOVE_STEPS = 30;
const RECORDING_SETTLE_MS = 200;

export const mouseMoveHandler: PlaywrightActionHandler = {
  cmd: 'mouse_move',
  estimateDurationMs: estimatePlaywrightActionDurationMs,

  async executeForCapture(page, action, ctx: CaptureContext) {
    if (!action.to) return null;
    const screenshotName = `step-${ctx.stepIndex}.png`;
    const screenshotPath = path.join(ctx.outputDir, screenshotName);
    await page.screenshot({ path: screenshotPath });
    const toPos: CursorPosition = { x: action.to[0], y: action.to[1] };
    await page.mouse.move(action.to[0], action.to[1], { steps: MOVE_STEPS });
    return {
      index: ctx.stepIndex,
      cmd: 'mouse_move',
      screenshot: screenshotName,
      cursorFrom: ctx.cursorPos,
      cursorTo: toPos,
      durationMs: 700,
      note: action.note,
    };
  },

  async executeForRecording(page, action, _ctx: RecordContext) {
    if (!action.to) return;
    await page.mouse.move(action.to[0], action.to[1], { steps: MOVE_STEPS });
    await page.waitForTimeout(RECORDING_SETTLE_MS);
  },

  async executeOffscreen(page, action, _ctx: OffscreenContext) {
    if (!action.to) return;
    await page.mouse.move(action.to[0], action.to[1], { steps: MOVE_STEPS });
  },
};
