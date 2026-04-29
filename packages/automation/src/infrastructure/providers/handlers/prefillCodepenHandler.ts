import * as path from 'path';
import {
  PlaywrightActionHandler,
  CaptureContext,
  RecordContext,
  OffscreenContext,
} from '../../../domain/playwright/PlaywrightActionHandler';
import {
  PLAYWRIGHT_TIMING,
  estimatePlaywrightActionDurationMs,
} from '../../../domain/playwright/ActionTiming';
import { executeCodepenPrefill } from '../playwrightBrowserUtils';

export const prefillCodepenHandler: PlaywrightActionHandler = {
  cmd: 'prefill_codepen',
  estimateDurationMs: estimatePlaywrightActionDurationMs,

  async executeForCapture(page, action, ctx: CaptureContext) {
    const screenshotName = `step-${ctx.stepIndex}.png`;
    const screenshotPath = path.join(ctx.outputDir, screenshotName);
    await executeCodepenPrefill(page, {
      html: action.html,
      css: action.css,
      js: action.js,
      editors: action.editors,
    });
    await page.screenshot({ path: screenshotPath });
    return {
      index: ctx.stepIndex,
      cmd: 'prefill_codepen',
      screenshot: screenshotName,
      cursorFrom: ctx.cursorPos,
      cursorTo: ctx.cursorPos,
      scrollY: 0,
      durationMs: PLAYWRIGHT_TIMING.prefillCodepenMs,
      note: action.note,
    };
  },

  async executeForRecording(page, action, ctx: RecordContext) {
    await executeCodepenPrefill(page, {
      html: action.html,
      css: action.css,
      js: action.js,
      editors: action.editors,
    });
    // CodePen pen 페이지 로드 후 커서 div 재주입 (goto 와 동일한 처리)
    await ctx.injectCursor();
  },

  async executeOffscreen(page, action, _ctx: OffscreenContext) {
    await executeCodepenPrefill(page, {
      html: action.html,
      css: action.css,
      js: action.js,
      editors: action.editors,
    });
  },
};
