import * as path from 'path';
import { Page } from 'playwright';
import {
  PlaywrightActionHandler,
  CaptureContext,
  RecordContext,
  OffscreenContext,
} from '../../../domain/playwright/PlaywrightActionHandler';
import { CursorPosition } from '../../../domain/entities/StepManifest';
import {
  PLAYWRIGHT_TIMING,
  estimatePlaywrightActionDurationMs,
} from '../../../domain/playwright/ActionTiming';
import { applyCaptureTransform } from '../playwrightCaptureExtractor';
import { saveCapture } from '../playwrightCaptureStore';
import {
  normalizeContextMenuItems,
  injectContextMenu,
  removeContextMenu,
} from '../playwrightContextMenu';

const RC_LOCATOR_TIMEOUT_MS = 10000;
const ATTRIBUTE_LOCATOR_TIMEOUT_MS = 10000;
const MOVE_STEPS = 30;
const CAPTURE_VISIBLE_CAP_MS = 200;

async function captureFromTarget(
  loc: any,
  config: { attribute?: string; transform?: any; saveAs: string },
  selector: string,
  lectureId: string,
  sceneId: number | undefined,
  logPrefix?: string,
): Promise<void> {
  const attr = config.attribute ?? 'src';
  const value = await loc.getAttribute(attr);
  if (value === null) {
    throw new Error(
      `right_click.captureFromTarget: selector ${selector} 의 ${attr} attribute 가 null 입니다`,
    );
  }
  const transformed = applyCaptureTransform(value, config.transform);
  await saveCapture(lectureId, config.saveAs, transformed, {
    sceneId,
    sourceCmd: 'right_click',
  });
  if (logPrefix) {
    console.log(`${logPrefix}${config.saveAs} = ${transformed.slice(0, 80)}`);
  }
}

export const rightClickHandler: PlaywrightActionHandler = {
  cmd: 'right_click',
  estimateDurationMs: estimatePlaywrightActionDurationMs,

  async executeForCapture(page, action, ctx: CaptureContext) {
    if (!action.selector) return null;
    const screenshotName = `step-${ctx.stepIndex}.png`;
    const screenshotPath = path.join(ctx.outputDir, screenshotName);
    const loc = page.locator(action.selector);
    await loc.waitFor({ state: 'visible', timeout: RC_LOCATOR_TIMEOUT_MS });
    const box = await loc.boundingBox();
    const target: CursorPosition = box
      ? { x: box.x + box.width / 2, y: box.y + box.height / 2 }
      : ctx.cursorPos;

    await page.mouse.move(target.x, target.y, { steps: MOVE_STEPS });

    if (action.captureFromTarget) {
      if (!ctx.lectureId) {
        throw new Error(
          `right_click.captureFromTarget 실행에는 lectureId 가 필요합니다 ` +
            `(saveAs=${action.captureFromTarget.saveAs}, sceneId=${ctx.sceneId ?? '?'})`,
        );
      }
      await captureFromTarget(
        loc,
        action.captureFromTarget,
        action.selector,
        ctx.lectureId,
        ctx.sceneId,
      );
    }

    let durationMs = PLAYWRIGHT_TIMING.rightClickBaseMs;
    if (action.showContextMenu) {
      const renderItems = normalizeContextMenuItems(
        action.showContextMenu.items,
        action.showContextMenu.clickItem,
      );
      await injectContextMenu(page, target, renderItems);
      if (action.showContextMenu.visibleMs !== undefined) {
        if (action.showContextMenu.visibleMs > 0) {
          await page.waitForTimeout(Math.min(action.showContextMenu.visibleMs, CAPTURE_VISIBLE_CAP_MS));
        }
        durationMs = PLAYWRIGHT_TIMING.rightClickBaseMs + action.showContextMenu.visibleMs;
      } else {
        const highlightDelay = action.showContextMenu.highlightDelayMs ?? 0;
        const clickDelay = action.showContextMenu.clickItem
          ? (action.showContextMenu.clickDelayMs ?? PLAYWRIGHT_TIMING.rightClickItemDelayMs)
          : 0;
        if (highlightDelay > 0) {
          await page.waitForTimeout(Math.min(highlightDelay, CAPTURE_VISIBLE_CAP_MS));
        }
        durationMs = PLAYWRIGHT_TIMING.rightClickBaseMs + highlightDelay + clickDelay;
      }
    }

    await page.screenshot({ path: screenshotPath });

    if (action.showContextMenu) {
      await removeContextMenu(page);
    }

    return {
      index: ctx.stepIndex,
      cmd: 'right_click',
      screenshot: screenshotName,
      cursorFrom: ctx.cursorPos,
      cursorTo: target,
      targetBox: box ? { x: box.x, y: box.y, width: box.width, height: box.height } : undefined,
      durationMs,
      isClick: true,
      note: action.note,
    };
  },

  async executeForRecording(page: Page, action, ctx: RecordContext) {
    if (!action.selector) return;
    const loc = page.locator(action.selector);
    await loc.waitFor({ state: 'visible', timeout: RC_LOCATOR_TIMEOUT_MS });
    const box = await loc.boundingBox();
    const target = box
      ? { x: box.x + box.width / 2, y: box.y + box.height / 2 }
      : { x: 0, y: 0 };
    await page.mouse.move(target.x, target.y, { steps: MOVE_STEPS });
    await page.waitForTimeout(200);

    if (action.captureFromTarget) {
      if (!ctx.lectureId) {
        throw new Error(
          `right_click.captureFromTarget 실행에는 lectureId 가 필요합니다 (saveAs=${action.captureFromTarget.saveAs})`,
        );
      }
      await captureFromTarget(
        loc,
        action.captureFromTarget,
        action.selector,
        ctx.lectureId,
        ctx.sceneId,
        '  > right_click capture: ',
      );
    }

    if (action.showContextMenu) {
      const renderItems = normalizeContextMenuItems(
        action.showContextMenu.items,
        action.showContextMenu.clickItem,
      );
      await injectContextMenu(page, target, renderItems);
      let totalVisibleMs: number;
      if (action.showContextMenu.visibleMs !== undefined) {
        totalVisibleMs = PLAYWRIGHT_TIMING.rightClickBaseMs + action.showContextMenu.visibleMs;
      } else {
        const highlightDelay = action.showContextMenu.highlightDelayMs ?? 0;
        const clickDelay = action.showContextMenu.clickItem
          ? (action.showContextMenu.clickDelayMs ?? PLAYWRIGHT_TIMING.rightClickItemDelayMs)
          : 0;
        totalVisibleMs = PLAYWRIGHT_TIMING.rightClickBaseMs + highlightDelay + clickDelay;
      }
      await page.waitForTimeout(totalVisibleMs);
      await removeContextMenu(page);
    } else {
      await page.waitForTimeout(PLAYWRIGHT_TIMING.rightClickBaseMs);
    }
  },

  async executeOffscreen(page, action, ctx: OffscreenContext) {
    // offscreen 에서는 시각 효과(컨텍스트 메뉴 오버레이) 를 생략하고 captureFromTarget 만 수행.
    if (!action.captureFromTarget || !action.selector) return;
    if (!ctx.lectureId) {
      throw new Error(
        `right_click.captureFromTarget 실행에는 lectureId 가 필요합니다 (saveAs=${action.captureFromTarget.saveAs})`,
      );
    }
    const loc = page.locator(action.selector);
    await loc.waitFor({ state: 'attached', timeout: ATTRIBUTE_LOCATOR_TIMEOUT_MS });
    await captureFromTarget(
      loc,
      action.captureFromTarget,
      action.selector,
      ctx.lectureId,
      ctx.sceneId,
    );
  },
};
