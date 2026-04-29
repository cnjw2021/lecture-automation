import * as path from 'path';
import {
  PlaywrightActionHandler,
  CaptureContext,
  RecordContext,
  OffscreenContext,
} from '../../../domain/playwright/PlaywrightActionHandler';
import { estimatePlaywrightActionDurationMs } from '../../../domain/playwright/ActionTiming';
import { typeWithTimeout } from '../playwrightBrowserUtils';

const TYPE_LOCATOR_TIMEOUT_MS = 10000;
const TYPE_DELAY_MS = 100;
const STEP_DURATION_MS_PER_CHAR = 120;

export const typeHandler: PlaywrightActionHandler = {
  cmd: 'type',
  estimateDurationMs: estimatePlaywrightActionDurationMs,

  async executeForCapture(page, action, ctx: CaptureContext) {
    if (!action.selector || !action.key) return null;
    const screenshotName = `step-${ctx.stepIndex}.png`;
    const screenshotPath = path.join(ctx.outputDir, screenshotName);
    const loc = page.locator(action.selector);
    await loc.waitFor({ state: 'visible', timeout: TYPE_LOCATOR_TIMEOUT_MS });
    const box = await loc.boundingBox();
    // 타이핑 완료 후 스크린샷: Remotion 의 monospace 오버레이가 실제 입력창 폰트/래핑과
    // 맞지 않아 placeholder 와 겹치고 박스 경계를 벗어나던 문제를 피하기 위해, 실제 입력창에
    // 래핑된 최종 상태를 캡처한다. typedText 는 manifest 에서 제외해 typing overlay 가 렌더되지 않도록 한다.
    await typeWithTimeout(loc, action.key, {
      delay: TYPE_DELAY_MS,
      selector: action.selector,
    });
    await page.screenshot({ path: screenshotPath });
    const charDuration = action.key.length * STEP_DURATION_MS_PER_CHAR;
    return {
      index: ctx.stepIndex,
      cmd: 'type',
      screenshot: screenshotName,
      cursorFrom: ctx.cursorPos,
      cursorTo: box
        ? { x: box.x + box.width / 2, y: box.y + box.height / 2 }
        : ctx.cursorPos,
      targetBox: box ? { x: box.x, y: box.y, width: box.width, height: box.height } : undefined,
      durationMs: Math.max(charDuration, 500),
      note: action.note,
    };
  },

  async executeForRecording(page, action, _ctx: RecordContext) {
    if (!action.selector || !action.key) return;
    const loc = page.locator(action.selector);
    await loc.waitFor({ state: 'visible', timeout: TYPE_LOCATOR_TIMEOUT_MS });
    await typeWithTimeout(loc, action.key, {
      delay: TYPE_DELAY_MS,
      selector: action.selector,
    });
  },

  async executeOffscreen(page, action, _ctx: OffscreenContext) {
    if (!action.selector || !action.key) return;
    const loc = page.locator(action.selector);
    await loc.waitFor({ state: 'visible', timeout: TYPE_LOCATOR_TIMEOUT_MS });
    await typeWithTimeout(loc, action.key, {
      delay: TYPE_DELAY_MS,
      selector: action.selector,
    });
  },
};
