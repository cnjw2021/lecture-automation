import * as path from 'path';
import {
  PlaywrightActionHandler,
  CaptureContext,
  RecordContext,
  OffscreenContext,
} from '../../../domain/playwright/PlaywrightActionHandler';
import { estimatePlaywrightActionDurationMs } from '../../../domain/playwright/ActionTiming';

const GOTO_TIMEOUT_MS = 20000;

export const gotoHandler: PlaywrightActionHandler = {
  cmd: 'goto',
  estimateDurationMs: estimatePlaywrightActionDurationMs,

  async executeForCapture(page, action, ctx: CaptureContext) {
    if (!action.url) return null;
    const screenshotName = `step-${ctx.stepIndex}.png`;
    const screenshotPath = path.join(ctx.outputDir, screenshotName);
    try {
      await page.goto(action.url, { waitUntil: 'load', timeout: GOTO_TIMEOUT_MS });
    } catch (_) {
      console.warn(`  ⚠️ goto 타임아웃, 현재 상태로 계속 진행`);
    }
    await page.screenshot({ path: screenshotPath });
    return {
      index: ctx.stepIndex,
      cmd: 'goto',
      screenshot: screenshotName,
      cursorFrom: ctx.cursorPos,
      cursorTo: ctx.cursorPos,
      scrollY: 0,
      durationMs: 1000,
      note: action.note,
    };
  },

  async executeForRecording(page, action, ctx: RecordContext) {
    let targetUrl: string | undefined = action.url;
    if (action.urlFromScene !== undefined) {
      const resolved = ctx.resolveUrlFromScene(action.urlFromScene);
      if (resolved) {
        targetUrl = resolved;
        console.log(`  > goto urlFromScene=${action.urlFromScene}: ${resolved}`);
      } else if (!targetUrl) {
        console.warn(`  ⚠️ goto urlFromScene=${action.urlFromScene} 실패 + url fallback 없음 (건너뜀)`);
        return;
      }
    }
    if (!targetUrl) return;
    try {
      await page.goto(targetUrl, { waitUntil: 'load', timeout: GOTO_TIMEOUT_MS });
    } catch (_) {
      console.warn(`  ⚠️ goto 타임아웃, 현재 상태로 계속 진행`);
    }
    if (ctx.hasStorageState) {
      ctx.checkSessionExpired(targetUrl);
    }
    await ctx.injectCursor();
  },

  async executeOffscreen(page, action, _ctx: OffscreenContext) {
    if (!action.url) return;
    // shared session 에서 goto 실패 = 페이지 상태 파괴 → 항상 throw
    await page.goto(action.url, { waitUntil: 'load', timeout: GOTO_TIMEOUT_MS });
  },
};
