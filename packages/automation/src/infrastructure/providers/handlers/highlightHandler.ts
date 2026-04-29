import * as path from 'path';
import {
  PlaywrightActionHandler,
  CaptureContext,
  RecordContext,
  OffscreenContext,
} from '../../../domain/playwright/PlaywrightActionHandler';
import { estimatePlaywrightActionDurationMs } from '../../../domain/playwright/ActionTiming';

const HIGHLIGHT_LOCATOR_TIMEOUT_MS = 10000;
const HIGHLIGHT_VISIBLE_MS = 1500;
const OFFSCREEN_LOCATOR_TIMEOUT_MS = 5000;
const HIGHLIGHT_CSS = '5px solid #ff007a';

export const highlightHandler: PlaywrightActionHandler = {
  cmd: 'highlight',
  estimateDurationMs: estimatePlaywrightActionDurationMs,

  async executeForCapture(page, action, ctx: CaptureContext) {
    if (!action.selector) return null;
    const screenshotName = `step-${ctx.stepIndex}.png`;
    const screenshotPath = path.join(ctx.outputDir, screenshotName);
    const loc = page.locator(action.selector);
    await loc.waitFor({ state: 'attached', timeout: HIGHLIGHT_LOCATOR_TIMEOUT_MS });
    const box = await loc.boundingBox();
    await loc.evaluate((el: HTMLElement) => {
      el.style.outline = '5px solid #ff007a';
    });
    await page.screenshot({ path: screenshotPath });
    return {
      index: ctx.stepIndex,
      cmd: 'highlight',
      screenshot: screenshotName,
      cursorFrom: ctx.cursorPos,
      cursorTo: ctx.cursorPos,
      targetBox: box ? { x: box.x, y: box.y, width: box.width, height: box.height } : undefined,
      durationMs: HIGHLIGHT_VISIBLE_MS,
      isHighlight: true,
      note: action.note,
    };
  },

  async executeForRecording(page, action, _ctx: RecordContext) {
    if (!action.selector) return;
    const loc = page.locator(action.selector);
    await loc.waitFor({ state: 'attached', timeout: HIGHLIGHT_LOCATOR_TIMEOUT_MS });
    await loc.evaluate((el: HTMLElement) => {
      el.style.outline = '5px solid #ff007a';
    });
    await page.waitForTimeout(HIGHLIGHT_VISIBLE_MS);
  },

  async executeOffscreen(page, action, _ctx: OffscreenContext) {
    // DOM 스타일 변경: 페이지 상태에 영향을 주므로 offscreen 에서도 실행.
    // selector miss/timeout = 잘못된 page 상태 → throw (swallow 금지)
    if (!action.selector) return;
    await page.locator(action.selector).waitFor({ state: 'attached', timeout: OFFSCREEN_LOCATOR_TIMEOUT_MS });
    await page.locator(action.selector).evaluate((el: HTMLElement) => {
      el.style.outline = '5px solid #ff007a';
    });
  },
};

// HIGHLIGHT_CSS 상수는 inline 으로 둔다 (page.evaluate 안에서 closure 캡처가 일관되도록)
void HIGHLIGHT_CSS;
