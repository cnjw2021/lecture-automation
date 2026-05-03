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

/**
 * action.iframe 이 지정된 경우 page.frameLocator(iframe).locator(selector) 를,
 * 지정되지 않은 경우 page.locator(selector) 를 반환한다.
 * iframe 내부 요소를 대상으로 하는 액션 (CodePen preview 폼 입력/클릭 등) 에 사용.
 */
function resolveLocator(page: any, action: any) {
  if (action.iframe) {
    return page.frameLocator(action.iframe).locator(action.selector);
  }
  return page.locator(action.selector);
}

export const clickHandler: PlaywrightActionHandler = {
  cmd: 'click',
  estimateDurationMs: estimatePlaywrightActionDurationMs,

  async executeForCapture(page, action, ctx: CaptureContext) {
    if (!action.selector) return null;
    const screenshotName = `step-${ctx.stepIndex}.png`;
    const screenshotPath = path.join(ctx.outputDir, screenshotName);
    const loc = resolveLocator(page, action);
    await loc.waitFor({ state: 'visible', timeout: CLICK_TIMEOUT_MS });
    // iframe 내부 요소는 boundingBox 좌표가 메인 페이지 기준이 아닐 수 있어
    // 커서 위치 추적 정확도가 떨어지지만, 시각적 큐는 frameLocator 가 자동 처리.
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
    await resolveLocator(page, action).click({ timeout: CLICK_TIMEOUT_MS });
  },

  async executeOffscreen(page, action, _ctx: OffscreenContext) {
    if (!action.selector) return;
    await resolveLocator(page, action).click({ timeout: CLICK_TIMEOUT_MS });
  },
};
