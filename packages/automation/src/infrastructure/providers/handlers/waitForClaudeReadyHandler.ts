import * as path from 'path';
import {
  PlaywrightActionHandler,
  CaptureContext,
  RecordContext,
  OffscreenContext,
} from '../../../domain/playwright/PlaywrightActionHandler';
import { estimatePlaywrightActionDurationMs } from '../../../domain/playwright/ActionTiming';
import { waitForClaudeReady } from '../playwrightClaudeWaiter';

const DEFAULT_CLAUDE_READY_TIMEOUT_MS = 180000;

export const waitForClaudeReadyHandler: PlaywrightActionHandler = {
  cmd: 'wait_for_claude_ready',
  estimateDurationMs: estimatePlaywrightActionDurationMs,

  async executeForCapture(page, action, ctx: CaptureContext) {
    const screenshotName = `step-${ctx.stepIndex}.png`;
    const screenshotPath = path.join(ctx.outputDir, screenshotName);
    const timeout = action.timeout ?? DEFAULT_CLAUDE_READY_TIMEOUT_MS;
    const startedAt = Date.now();
    await waitForClaudeReady(page, timeout, { onTimeout: 'throw' });
    const elapsed = Date.now() - startedAt;
    await page.screenshot({ path: screenshotPath });
    return {
      index: ctx.stepIndex,
      cmd: 'wait_for_claude_ready',
      screenshot: screenshotName,
      cursorFrom: ctx.cursorPos,
      cursorTo: ctx.cursorPos,
      durationMs: Math.max(elapsed, 500),
      note: action.note,
    };
  },

  async executeForRecording(_page, action, ctx: RecordContext) {
    // 녹화 모드: timeout 시 warn + 계속 진행 (단일 timeout 으로 webm 전체 파이프라인 죽이지 않음)
    await ctx.waitForClaudeReady(action.timeout ?? DEFAULT_CLAUDE_READY_TIMEOUT_MS);
  },

  async executeOffscreen(page, action, _ctx: OffscreenContext) {
    await waitForClaudeReady(page, action.timeout ?? DEFAULT_CLAUDE_READY_TIMEOUT_MS, {
      onTimeout: 'throw',
    });
  },
};
