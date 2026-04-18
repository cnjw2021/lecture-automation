import { Page } from 'playwright';
import * as path from 'path';
import { PlaywrightAction } from '../../domain/entities/Lecture';
import { StepData, CursorPosition } from '../../domain/entities/StepManifest';
import { executeEduDevtoolsAction, getEduDevtoolsActionDuration } from './playwrightEduDevtools';

/**
 * Playwright 액션을 실행하고 그 결과를 합성 캡처용 StepData 로 환원한다.
 *
 * SSoT 목적:
 *   - PlaywrightStateCaptureProvider (씬 단위)
 *   - SharedPlaywrightStateCaptureProvider (세션 단위)
 * 두 프로바이더가 같은 액션 실행/캡처 로직을 공유하도록 하나의 순수 모듈로 분리.
 *
 * offscreen 액션(공유 세션의 가변 대기 등)은 executeOffscreen 으로 별도 처리한다.
 */

export interface StepCaptureContext {
  stepIndex: number;
  outputDir: string;
  cursorPos: CursorPosition;
}

export async function executeAndCaptureStep(
  page: Page,
  action: PlaywrightAction,
  ctx: StepCaptureContext,
): Promise<StepData | null> {
  const screenshotName = `step-${ctx.stepIndex}.png`;
  const screenshotPath = path.join(ctx.outputDir, screenshotName);
  const { cursorPos, stepIndex } = ctx;

  switch (action.cmd) {
    case 'goto': {
      if (!action.url) return null;
      try {
        await page.goto(action.url, { waitUntil: 'load', timeout: 20000 });
      } catch (_) {
        console.warn(`  ⚠️ goto 타임아웃, 현재 상태로 계속 진행`);
      }
      await page.screenshot({ path: screenshotPath });
      return {
        index: stepIndex,
        cmd: 'goto',
        screenshot: screenshotName,
        cursorFrom: cursorPos,
        cursorTo: cursorPos,
        scrollY: 0,
        durationMs: 1000,
        note: action.note,
      };
    }

    case 'wait': {
      await page.screenshot({ path: screenshotPath });
      return {
        index: stepIndex,
        cmd: 'wait',
        screenshot: screenshotName,
        cursorFrom: cursorPos,
        cursorTo: cursorPos,
        durationMs: action.ms || 1000,
        note: action.note,
      };
    }

    case 'wait_for': {
      if (!action.selector) return null;
      const state = action.state ?? 'visible';
      const timeout = action.timeout ?? 30000;
      const startedAt = Date.now();
      try {
        await page.locator(action.selector).waitFor({ state, timeout });
      } catch (err: any) {
        console.warn(`  ⚠️ wait_for 타임아웃 (${action.selector}): ${err.message}`);
      }
      const elapsed = Date.now() - startedAt;
      await page.screenshot({ path: screenshotPath });
      return {
        index: stepIndex,
        cmd: 'wait_for',
        screenshot: screenshotName,
        cursorFrom: cursorPos,
        cursorTo: cursorPos,
        durationMs: Math.max(elapsed, 500),
        note: action.note,
      };
    }

    case 'wait_for_claude_ready': {
      const timeout = action.timeout ?? 180000;
      const startedAt = Date.now();
      await waitForClaudeReady(page, timeout);
      const elapsed = Date.now() - startedAt;
      await page.screenshot({ path: screenshotPath });
      return {
        index: stepIndex,
        cmd: 'wait_for_claude_ready',
        screenshot: screenshotName,
        cursorFrom: cursorPos,
        cursorTo: cursorPos,
        durationMs: Math.max(elapsed, 500),
        note: action.note,
      };
    }

    case 'scroll': {
      const deltaY = action.deltaY ?? 300;
      await page.mouse.wheel(0, deltaY);
      await page.waitForTimeout(300);
      await page.screenshot({ path: screenshotPath });
      return {
        index: stepIndex,
        cmd: 'scroll',
        screenshot: screenshotName,
        cursorFrom: cursorPos,
        cursorTo: cursorPos,
        durationMs: 500,
        note: action.note,
      };
    }

    case 'mouse_move': {
      if (!action.to) return null;
      await page.screenshot({ path: screenshotPath });
      const toPos: CursorPosition = { x: action.to[0], y: action.to[1] };
      await page.mouse.move(action.to[0], action.to[1], { steps: 30 });
      return {
        index: stepIndex,
        cmd: 'mouse_move',
        screenshot: screenshotName,
        cursorFrom: cursorPos,
        cursorTo: toPos,
        durationMs: 700,
        note: action.note,
      };
    }

    case 'click': {
      if (!action.selector) return null;
      const clickLoc = page.locator(action.selector);
      await clickLoc.waitFor({ state: 'visible', timeout: 10000 });
      const box = await clickLoc.boundingBox();
      await page.screenshot({ path: screenshotPath });
      const clickTarget: CursorPosition = box
        ? { x: box.x + box.width / 2, y: box.y + box.height / 2 }
        : cursorPos;
      await clickLoc.click({ timeout: 10000 });
      return {
        index: stepIndex,
        cmd: 'click',
        screenshot: screenshotName,
        cursorFrom: cursorPos,
        cursorTo: clickTarget,
        targetBox: box ? { x: box.x, y: box.y, width: box.width, height: box.height } : undefined,
        durationMs: 500,
        isClick: true,
        note: action.note,
      };
    }

    case 'type': {
      if (!action.selector || !action.key) return null;
      const typeLoc = page.locator(action.selector);
      await typeLoc.waitFor({ state: 'visible', timeout: 10000 });
      const typeBox = await typeLoc.boundingBox();
      await page.screenshot({ path: screenshotPath });
      await typeLoc.pressSequentially(action.key, { delay: 100 });
      const charDuration = action.key.length * 120;
      return {
        index: stepIndex,
        cmd: 'type',
        screenshot: screenshotName,
        cursorFrom: cursorPos,
        cursorTo: typeBox
          ? { x: typeBox.x + typeBox.width / 2, y: typeBox.y + typeBox.height / 2 }
          : cursorPos,
        targetBox: typeBox ? { x: typeBox.x, y: typeBox.y, width: typeBox.width, height: typeBox.height } : undefined,
        typedText: action.key,
        durationMs: Math.max(charDuration, 500),
        note: action.note,
      };
    }

    case 'focus': {
      if (!action.selector) return null;
      const focusLoc = page.locator(action.selector);
      await focusLoc.waitFor({ state: 'visible', timeout: 10000 });
      const focusBox = await focusLoc.boundingBox();
      await page.screenshot({ path: screenshotPath });
      await focusLoc.focus();
      return {
        index: stepIndex,
        cmd: 'focus',
        screenshot: screenshotName,
        cursorFrom: cursorPos,
        cursorTo: focusBox
          ? { x: focusBox.x + focusBox.width / 2, y: focusBox.y + focusBox.height / 2 }
          : cursorPos,
        targetBox: focusBox ? { x: focusBox.x, y: focusBox.y, width: focusBox.width, height: focusBox.height } : undefined,
        durationMs: 300,
        note: action.note,
      };
    }

    case 'mouse_drag': {
      if (!action.from || !action.to) return null;
      await page.screenshot({ path: screenshotPath });
      await page.mouse.move(action.from[0], action.from[1]);
      await page.mouse.down();
      await page.mouse.move(action.to[0], action.to[1], { steps: 10 });
      await page.mouse.up();
      return {
        index: stepIndex,
        cmd: 'mouse_drag',
        screenshot: screenshotName,
        cursorFrom: { x: action.from[0], y: action.from[1] },
        cursorTo: { x: action.to[0], y: action.to[1] },
        durationMs: 800,
        note: action.note,
      };
    }

    case 'press': {
      if (!action.key) return null;
      await page.screenshot({ path: screenshotPath });
      await page.keyboard.press(action.key);
      return {
        index: stepIndex,
        cmd: 'press',
        screenshot: screenshotName,
        cursorFrom: cursorPos,
        cursorTo: cursorPos,
        durationMs: 300,
        note: action.note,
      };
    }

    case 'highlight': {
      if (!action.selector) return null;
      const hlLoc = page.locator(action.selector);
      await hlLoc.waitFor({ state: 'attached', timeout: 10000 });
      const hlBox = await hlLoc.boundingBox();
      await hlLoc.evaluate((el: HTMLElement) => {
        el.style.outline = '5px solid #ff007a';
      });
      await page.screenshot({ path: screenshotPath });
      return {
        index: stepIndex,
        cmd: 'highlight',
        screenshot: screenshotName,
        cursorFrom: cursorPos,
        cursorTo: cursorPos,
        targetBox: hlBox ? { x: hlBox.x, y: hlBox.y, width: hlBox.width, height: hlBox.height } : undefined,
        durationMs: 1500,
        isHighlight: true,
        note: action.note,
      };
    }

    case 'open_devtools':
    case 'select_devtools_node':
    case 'toggle_devtools_node': {
      const result = await executeEduDevtoolsAction(page, action);
      if (!result?.ok) return null;
      const durationMs = getEduDevtoolsActionDuration(action.cmd) ?? 0;
      if (durationMs > 0) {
        await page.waitForTimeout(Math.min(durationMs, 300));
      }
      await page.screenshot({ path: screenshotPath });
      return {
        index: stepIndex,
        cmd: action.cmd,
        screenshot: screenshotName,
        cursorFrom: cursorPos,
        cursorTo: cursorPos,
        durationMs,
        note: action.note,
      };
    }

    case 'disable_css': {
      await page.evaluate(() => {
        Array.from(document.styleSheets).forEach(sheet => {
          try {
            const owner = sheet.ownerNode as Element | null;
            if (owner?.id?.startsWith('__edu')) return;
            if (owner?.closest?.('#__edu_devtools__')) return;
            sheet.disabled = true;
          } catch (_) {}
        });
      });
      await page.waitForTimeout(200);
      await page.screenshot({ path: screenshotPath });
      return {
        index: stepIndex,
        cmd: 'disable_css',
        screenshot: screenshotName,
        cursorFrom: cursorPos,
        cursorTo: cursorPos,
        durationMs: 500,
        note: action.note,
      };
    }

    case 'enable_css': {
      await page.evaluate(() => {
        Array.from(document.styleSheets).forEach(sheet => {
          try { sheet.disabled = false; } catch (_) {}
        });
      });
      await page.waitForTimeout(200);
      await page.screenshot({ path: screenshotPath });
      return {
        index: stepIndex,
        cmd: 'enable_css',
        screenshot: screenshotName,
        cursorFrom: cursorPos,
        cursorTo: cursorPos,
        durationMs: 500,
        note: action.note,
      };
    }

    default:
      console.warn(`  ⚠️ 미지원 Action '${action.cmd}' (건너뜀)`);
      return null;
  }
}

/**
 * offscreen 액션: 실제 세션에서 실행만 하고 캡처 step 은 생성하지 않는다.
 * 공유 세션(P-D)에서 LLM 응답 대기 등 가변 지연을 씬 바깥으로 밀어낼 때 사용.
 */
export async function executeActionOffscreen(
  page: Page,
  action: PlaywrightAction,
): Promise<void> {
  switch (action.cmd) {
    case 'goto': {
      if (!action.url) return;
      try {
        await page.goto(action.url, { waitUntil: 'load', timeout: 20000 });
      } catch (_) {
        console.warn(`  ⚠️ offscreen goto 타임아웃, 계속 진행`);
      }
      return;
    }
    case 'wait':
      if (action.ms) await page.waitForTimeout(action.ms);
      return;
    case 'wait_for': {
      if (!action.selector) return;
      const state = action.state ?? 'visible';
      const timeout = action.timeout ?? 30000;
      try {
        await page.locator(action.selector).waitFor({ state, timeout });
      } catch (err: any) {
        console.warn(`  ⚠️ offscreen wait_for 타임아웃 (${action.selector}): ${err.message}`);
      }
      return;
    }
    case 'wait_for_claude_ready':
      await waitForClaudeReady(page, action.timeout ?? 180000);
      return;
    case 'scroll':
      await page.mouse.wheel(0, action.deltaY ?? 300);
      await page.waitForTimeout(300);
      return;
    case 'mouse_move':
      if (action.to) await page.mouse.move(action.to[0], action.to[1], { steps: 30 });
      return;
    case 'click':
      if (action.selector) await page.locator(action.selector).click({ timeout: 10000 });
      return;
    case 'type':
      if (action.selector && action.key) {
        const loc = page.locator(action.selector);
        await loc.waitFor({ state: 'visible', timeout: 10000 });
        await loc.pressSequentially(action.key, { delay: 100 });
      }
      return;
    case 'focus':
      if (action.selector) {
        const loc = page.locator(action.selector);
        await loc.waitFor({ state: 'visible', timeout: 10000 });
        await loc.focus();
      }
      return;
    case 'press':
      if (action.key) await page.keyboard.press(action.key);
      return;
    default:
      console.warn(`  ⚠️ offscreen 미지원 Action '${action.cmd}' (건너뜀)`);
      return;
  }
}

/**
 * Claude.ai 응답 완료 감지.
 * streaming="true" → streaming="false" 전이, 빈 그리팅 페이지 제외, Artifact/Prose 존재 휴리스틱.
 */
async function waitForClaudeReady(page: Page, timeoutMs: number): Promise<void> {
  const startedAt = Date.now();
  const deadline = startedAt + timeoutMs;
  const hints = [
    'Claude 응답 대기 중...',
    '시간이 조금 걸리고 있습니다...',
    '조금 더 기다려 봅시다...',
    '곧 응답이 돌아올 것 같습니다...',
    '응답 생성이 계속되고 있습니다, 잠시만요...',
  ];
  let attempt = 0;

  while (Date.now() < deadline) {
    const state = await page.evaluate(() => {
      const streamingTrue = document.querySelector('[data-is-streaming="true"]');
      if (streamingTrue) return 'streaming';

      const emptyGreeting = Array.from(document.querySelectorAll('h1, h2, p, div'))
        .find(el => {
          const t = (el.textContent || '').trim();
          return t === '本日はどのようなお手伝いができますか？'
            || t === 'How can I help you today?'
            || t.startsWith('本日はどのような');
        });
      if (emptyGreeting) return 'empty';

      const streamingFalse = document.querySelector('[data-is-streaming="false"]');
      if (streamingFalse) return 'ready';

      const hasArtifact = !!document.querySelector(
        '[aria-label*="artifact" i], [class*="artifact-block" i], button[aria-label*="アーティファクト"]'
      );
      const hasProse = document.querySelectorAll('.prose, [class*="message-"]').length > 0;
      if (hasArtifact || hasProse) return 'ready';

      return 'unknown';
    }).catch(() => 'unknown');

    if (state === 'ready') {
      const elapsed = Math.round((Date.now() - startedAt) / 1000);
      console.log(`  > Claude 응답 준비 완료 (경과: ${elapsed}s)`);
      return;
    }

    const hint = hints[Math.min(attempt, hints.length - 1)];
    const elapsed = Math.round((Date.now() - startedAt) / 1000);
    console.log(`  > ${hint} (상태: ${state}, 경과: ${elapsed}s)`);
    attempt++;
    await page.waitForTimeout(10000);
  }
  console.warn(`  ⚠️ Claude 응답 대기 타임아웃 (${timeoutMs}ms) — 계속 진행`);
}
