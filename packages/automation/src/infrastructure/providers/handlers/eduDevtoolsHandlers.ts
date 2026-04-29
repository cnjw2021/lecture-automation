import * as path from 'path';
import {
  PlaywrightActionHandler,
  CaptureContext,
  RecordContext,
  OffscreenContext,
} from '../../../domain/playwright/PlaywrightActionHandler';
import { PlaywrightCmd } from '../../../domain/entities/Lecture';
import { estimatePlaywrightActionDurationMs } from '../../../domain/playwright/ActionTiming';
import {
  executeEduDevtoolsAction,
  getEduDevtoolsActionDuration,
} from '../playwrightEduDevtools';

const SCREENSHOT_SETTLE_CAP_MS = 300;

/**
 * open_devtools / select_devtools_node / toggle_devtools_node 는 dispatch 가 동일하다.
 * cmd 별로 하나의 핸들러 인스턴스를 만들어 registry 에 등록한다.
 *
 * 모두 G-rule TEACHING_CMDS 대상.
 */
function createEduDevtoolsHandler(cmd: PlaywrightCmd): PlaywrightActionHandler {
  return {
    cmd,
    estimateDurationMs: estimatePlaywrightActionDurationMs,

    async executeForCapture(page, action, ctx: CaptureContext) {
      const screenshotName = `step-${ctx.stepIndex}.png`;
      const screenshotPath = path.join(ctx.outputDir, screenshotName);
      const result = await executeEduDevtoolsAction(page, action);
      if (!result?.ok) return null;
      const durationMs = getEduDevtoolsActionDuration(action.cmd) ?? 0;
      if (durationMs > 0) {
        await page.waitForTimeout(Math.min(durationMs, SCREENSHOT_SETTLE_CAP_MS));
      }
      await page.screenshot({ path: screenshotPath });
      return {
        index: ctx.stepIndex,
        cmd: action.cmd,
        screenshot: screenshotName,
        cursorFrom: ctx.cursorPos,
        cursorTo: ctx.cursorPos,
        durationMs,
        note: action.note,
      };
    },

    async executeForRecording(page, action, _ctx: RecordContext) {
      const result = await executeEduDevtoolsAction(page, action);
      if (!result?.ok) {
        throw new Error(result?.reason || `DevTools action failed: ${action.cmd}`);
      }
      const settleMs = getEduDevtoolsActionDuration(action.cmd) ?? 0;
      if (settleMs > 0) {
        await page.waitForTimeout(settleMs);
      }
    },

    async executeOffscreen(page, action, _ctx: OffscreenContext) {
      // 교육용 DevTools 오버레이: DOM 주입이므로 후속 씬 상태 복원을 위해 실행.
      // 실패 = 오버레이 미주입 = page 상태 불완전 → throw (swallow 금지)
      await executeEduDevtoolsAction(page, action);
    },
  };
}

export const openDevtoolsHandler = createEduDevtoolsHandler('open_devtools');
export const selectDevtoolsNodeHandler = createEduDevtoolsHandler('select_devtools_node');
export const toggleDevtoolsNodeHandler = createEduDevtoolsHandler('toggle_devtools_node');
