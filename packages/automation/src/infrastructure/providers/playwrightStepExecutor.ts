import { Page } from 'playwright';
import * as path from 'path';
import { PlaywrightAction, ContextMenuItem, CaptureTransform } from '../../domain/entities/Lecture';
import { StepData, CursorPosition } from '../../domain/entities/StepManifest';
import { executeEduDevtoolsAction, getEduDevtoolsActionDuration } from './playwrightEduDevtools';
import { typeWithTimeout, executeCodepenPrefill } from './playwrightBrowserUtils';
import { PLAYWRIGHT_TIMING } from '../../domain/playwright/ActionTiming';
import { expandCapturePlaceholders, saveCapture } from './playwrightCaptureStore';

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
  /**
   * ${capture:key} placeholder 치환 및 capture/right_click 액션의 saveAs 저장에 사용.
   * 빈 문자열 또는 미지정이면 placeholder 가 있을 경우 strict 모드로 throw.
   */
  lectureId?: string;
  /** capture 액션 실행 시 saveAs 메타에 기록될 sceneId */
  sceneId?: number;
}

const CONTEXT_MENU_ELEMENT_ID = '__playwright_context_menu__';

interface ContextMenuRenderItem {
  label: string;
  highlighted: boolean;
  separator: boolean;
}

function normalizeContextMenuItems(
  items: ContextMenuItem[],
  clickItem: string | undefined,
): ContextMenuRenderItem[] {
  return items.map((item) => {
    if (typeof item === 'string') {
      return { label: item, highlighted: clickItem !== undefined && item === clickItem, separator: false };
    }
    if (item.separator) {
      return { label: '', highlighted: false, separator: true };
    }
    const label = item.label ?? '';
    const explicit = item.highlighted === true;
    const isClickTarget = clickItem !== undefined && label === clickItem;
    return { label, highlighted: explicit || isClickTarget, separator: false };
  });
}

async function injectContextMenu(
  page: Page,
  position: { x: number; y: number },
  renderItems: ContextMenuRenderItem[],
): Promise<void> {
  await page.evaluate(
    ({ position, renderItems, elementId }) => {
      document.getElementById(elementId)?.remove();
      const menu = document.createElement('div');
      menu.id = elementId;
      menu.style.cssText = [
        'position: fixed',
        `left: ${position.x}px`,
        `top: ${position.y}px`,
        'background: #ffffff',
        'border: 1px solid #cccccc',
        'border-radius: 8px',
        'box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15)',
        'padding: 6px 0',
        "font-family: -apple-system, BlinkMacSystemFont, 'Hiragino Sans', sans-serif",
        'font-size: 14px',
        'color: #202124',
        'z-index: 2147483647',
        'min-width: 280px',
        'pointer-events: none',
      ].join(';');
      renderItems.forEach((item) => {
        if (item.separator) {
          const sep = document.createElement('div');
          sep.style.cssText = 'height: 1px; background: #e0e0e0; margin: 4px 8px;';
          menu.appendChild(sep);
          return;
        }
        const row = document.createElement('div');
        row.textContent = item.label;
        const base = 'padding: 6px 16px; white-space: nowrap;';
        const accent = item.highlighted ? ' background: #1a73e8; color: #ffffff;' : '';
        row.style.cssText = base + accent;
        menu.appendChild(row);
      });
      document.body.appendChild(menu);
      const rect = menu.getBoundingClientRect();
      if (rect.right > window.innerWidth) {
        menu.style.left = `${Math.max(0, window.innerWidth - rect.width - 8)}px`;
      }
      if (rect.bottom > window.innerHeight) {
        menu.style.top = `${Math.max(0, window.innerHeight - rect.height - 8)}px`;
      }
    },
    { position, renderItems, elementId: CONTEXT_MENU_ELEMENT_ID },
  );
}

async function removeContextMenu(page: Page): Promise<void> {
  await page.evaluate((elementId) => {
    document.getElementById(elementId)?.remove();
  }, CONTEXT_MENU_ELEMENT_ID);
}

function applyCaptureTransform(raw: string, transform: CaptureTransform | undefined): string {
  if (!transform) return raw;
  if (transform.type === 'regex') {
    const re = new RegExp(transform.pattern);
    const m = raw.match(re);
    if (!m) {
      throw new Error(
        `capture transform regex 매치 실패: pattern=${transform.pattern}, raw=${raw.slice(0, 200)}`,
      );
    }
    const group = transform.group ?? 1;
    return m[group] ?? m[0];
  }
  return raw;
}

async function readCaptureSourceValue(
  page: Page,
  options: { selector?: string; attribute?: string; fromUrl?: boolean },
): Promise<string> {
  if (options.fromUrl) {
    return page.url();
  }
  if (!options.selector) {
    throw new Error('capture: selector 또는 fromUrl 중 하나가 필요합니다');
  }
  const attr = options.attribute ?? 'src';
  const loc = page.locator(options.selector);
  await loc.waitFor({ state: 'attached', timeout: 10000 });
  const value = await loc.getAttribute(attr);
  if (value === null) {
    throw new Error(
      `capture: selector ${options.selector} 의 ${attr} attribute 가 null 입니다`,
    );
  }
  return value;
}

const CAPTURE_EXPANDABLE_FIELDS: (keyof PlaywrightAction)[] = [
  'url',
  'selector',
  'key',
  'html',
  'css',
  'js',
];

/**
 * 액션의 string 필드에서 ${capture:key} placeholder 를 디스크 저장값으로 치환한 새 액션을 반환한다.
 * lectureId 가 비어 있고 placeholder 도 없으면 원본을 그대로 반환.
 */
async function expandActionPlaceholders(
  action: PlaywrightAction,
  lectureId: string | undefined,
): Promise<PlaywrightAction> {
  if (!lectureId) {
    // placeholder 가 있는데 lectureId 가 없으면 명시적으로 실패
    for (const field of CAPTURE_EXPANDABLE_FIELDS) {
      const v = action[field];
      if (typeof v === 'string' && v.includes('${capture:')) {
        throw new Error(
          `expandActionPlaceholders: '${action.cmd}' 액션의 ${String(field)} 에 \${capture:...} 가 있지만 ` +
            `lectureId 가 전달되지 않았습니다. PlaywrightStateCaptureProvider 호출자에서 lectureId 를 전달하세요.`,
        );
      }
    }
    return action;
  }
  const next: PlaywrightAction = { ...action };
  let changed = false;
  for (const field of CAPTURE_EXPANDABLE_FIELDS) {
    const v = next[field];
    if (typeof v === 'string' && v.includes('${capture:')) {
      const expanded = await expandCapturePlaceholders(lectureId, v);
      if (expanded !== v) {
        (next as any)[field] = expanded;
        changed = true;
      }
    }
  }
  return changed ? next : action;
}

export async function executeAndCaptureStep(
  page: Page,
  rawAction: PlaywrightAction,
  ctx: StepCaptureContext,
): Promise<StepData | null> {
  const action = await expandActionPlaceholders(rawAction, ctx.lectureId);
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

    case 'prefill_codepen': {
      await executeCodepenPrefill(page, {
        html: action.html,
        css: action.css,
        js: action.js,
        editors: action.editors,
      });
      await page.screenshot({ path: screenshotPath });
      return {
        index: stepIndex,
        cmd: 'prefill_codepen',
        screenshot: screenshotName,
        cursorFrom: cursorPos,
        cursorTo: cursorPos,
        scrollY: 0,
        durationMs: PLAYWRIGHT_TIMING.prefillCodepenMs,
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
      // 타이핑 완료 후 스크린샷: Remotion 의 monospace 오버레이가 실제 입력창 폰트/래핑과
      // 맞지 않아 placeholder 와 겹치고 박스 경계를 벗어나던 문제를 피하기 위해,
      // 실제 입력창에 래핑된 최종 상태를 캡처한다. typedText 는 manifest 에서 제외해
      // Remotion 의 typing overlay 가 렌더되지 않도록 한다.
      await typeWithTimeout(typeLoc, action.key, {
        delay: 100,
        selector: action.selector,
      });
      await page.screenshot({ path: screenshotPath });
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

    case 'capture': {
      if (!action.saveAs) {
        console.warn(`  ⚠️ capture 액션에 saveAs 가 없습니다 (스킵)`);
        return null;
      }
      if (!ctx.lectureId) {
        throw new Error(
          `capture 액션 실행에는 lectureId 가 필요합니다 (saveAs=${action.saveAs}, sceneId=${ctx.sceneId ?? '?'})`,
        );
      }
      const raw = await readCaptureSourceValue(page, {
        selector: action.selector,
        attribute: action.attribute,
        fromUrl: action.fromUrl,
      });
      const transformed = applyCaptureTransform(raw, action.transform);
      await saveCapture(ctx.lectureId, action.saveAs, transformed, {
        sceneId: ctx.sceneId,
        sourceCmd: 'capture',
      });
      // capture 는 시각 효과가 없으므로 manifest step 을 만들지 않는다.
      return null;
    }

    case 'right_click': {
      if (!action.selector) return null;
      const rcLoc = page.locator(action.selector);
      await rcLoc.waitFor({ state: 'visible', timeout: 10000 });
      const rcBox = await rcLoc.boundingBox();
      const rcTarget: CursorPosition = rcBox
        ? { x: rcBox.x + rcBox.width / 2, y: rcBox.y + rcBox.height / 2 }
        : cursorPos;

      await page.mouse.move(rcTarget.x, rcTarget.y, { steps: 30 });

      // captureFromTarget: 메뉴 표시 전에 attribute 추출 (메뉴 div 가 selector 매칭에 영향 주지 않도록)
      if (action.captureFromTarget) {
        if (!ctx.lectureId) {
          throw new Error(
            `right_click.captureFromTarget 실행에는 lectureId 가 필요합니다 ` +
              `(saveAs=${action.captureFromTarget.saveAs}, sceneId=${ctx.sceneId ?? '?'})`,
          );
        }
        const attr = action.captureFromTarget.attribute ?? 'src';
        const value = await rcLoc.getAttribute(attr);
        if (value === null) {
          throw new Error(
            `right_click.captureFromTarget: selector ${action.selector} 의 ${attr} attribute 가 null 입니다`,
          );
        }
        const transformed = applyCaptureTransform(value, action.captureFromTarget.transform);
        await saveCapture(
          ctx.lectureId,
          action.captureFromTarget.saveAs,
          transformed,
          { sceneId: ctx.sceneId, sourceCmd: 'right_click' },
        );
      }

      let durationMs = PLAYWRIGHT_TIMING.rightClickBaseMs;
      if (action.showContextMenu) {
        const renderItems = normalizeContextMenuItems(
          action.showContextMenu.items,
          action.showContextMenu.clickItem,
        );
        await injectContextMenu(page, rcTarget, renderItems);
        const highlightDelay = action.showContextMenu.highlightDelayMs ?? 0;
        const clickDelay = action.showContextMenu.clickItem
          ? (action.showContextMenu.clickDelayMs ?? PLAYWRIGHT_TIMING.rightClickItemDelayMs)
          : 0;
        if (highlightDelay > 0) {
          await page.waitForTimeout(Math.min(highlightDelay, 200));
        }
        durationMs = PLAYWRIGHT_TIMING.rightClickBaseMs + highlightDelay + clickDelay;
      }

      await page.screenshot({ path: screenshotPath });

      if (action.showContextMenu) {
        await removeContextMenu(page);
      }

      return {
        index: stepIndex,
        cmd: 'right_click',
        screenshot: screenshotName,
        cursorFrom: cursorPos,
        cursorTo: rcTarget,
        targetBox: rcBox
          ? { x: rcBox.x, y: rcBox.y, width: rcBox.width, height: rcBox.height }
          : undefined,
        durationMs,
        isClick: true,
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
export interface OffscreenContext {
  lectureId?: string;
  sceneId?: number;
}

export async function executeActionOffscreen(
  page: Page,
  rawAction: PlaywrightAction,
  ctx: OffscreenContext = {},
): Promise<void> {
  const action = await expandActionPlaceholders(rawAction, ctx.lectureId);
  switch (action.cmd) {
    case 'goto': {
      if (!action.url) return;
      // shared session 에서 goto 실패 = 페이지 상태 파괴 → 항상 throw
      await page.goto(action.url, { waitUntil: 'load', timeout: 20000 });
      return;
    }
    case 'prefill_codepen': {
      await executeCodepenPrefill(page, {
        html: action.html,
        css: action.css,
        js: action.js,
        editors: action.editors,
      });
      return;
    }
    case 'wait':
      if (action.ms) await page.waitForTimeout(action.ms);
      return;
    case 'wait_for': {
      if (!action.selector) return;
      const state = action.state ?? 'visible';
      const timeout = action.timeout ?? 30000;
      // timeout = 페이지 상태 불확실 → 항상 throw (swallow 금지)
      await page.locator(action.selector).waitFor({ state, timeout });
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
        await typeWithTimeout(loc, action.key, {
          delay: 100,
          selector: action.selector,
        });
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
    case 'mouse_drag':
      if (action.from && action.to) {
        await page.mouse.move(action.from[0], action.from[1]);
        await page.mouse.down();
        await page.mouse.move(action.to[0], action.to[1], { steps: 10 });
        await page.mouse.up();
      }
      return;
    case 'highlight':
      // DOM 스타일 변경: 페이지 상태에 영향을 주므로 offscreen에서도 실행
      // selector miss/timeout = 잘못된 page 상태 → throw (swallow 금지)
      if (action.selector) {
        await page.locator(action.selector).waitFor({ state: 'attached', timeout: 5000 });
        await page.locator(action.selector).evaluate((el: HTMLElement) => {
          el.style.outline = '5px solid #ff007a';
        });
      }
      return;
    case 'disable_css':
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
      return;
    case 'enable_css':
      await page.evaluate(() => {
        Array.from(document.styleSheets).forEach(sheet => {
          try { sheet.disabled = false; } catch (_) {}
        });
      });
      return;
    case 'open_devtools':
    case 'select_devtools_node':
    case 'toggle_devtools_node':
      // 교육용 DevTools 오버레이: DOM 주입이므로 후속 씬 상태 복원을 위해 실행
      // 실패 = 오버레이 미주입 = page 상태 불완전 → throw (swallow 금지)
      await executeEduDevtoolsAction(page, action);
      return;
    case 'render_code_block':
      // 순수 시각 효과, 페이지 상태에 영향 없음 → no-op
      return;
    case 'capture': {
      // 페이지 상태 추출은 offscreen 에서도 동일하게 수행 (시각 효과 없음)
      if (!action.saveAs) return;
      if (!ctx.lectureId) {
        throw new Error(
          `capture 액션 실행에는 lectureId 가 필요합니다 (saveAs=${action.saveAs})`,
        );
      }
      const raw = await readCaptureSourceValue(page, {
        selector: action.selector,
        attribute: action.attribute,
        fromUrl: action.fromUrl,
      });
      const transformed = applyCaptureTransform(raw, action.transform);
      await saveCapture(ctx.lectureId, action.saveAs, transformed, {
        sceneId: ctx.sceneId,
        sourceCmd: 'capture',
      });
      return;
    }
    case 'right_click': {
      // offscreen 에서는 시각 효과(컨텍스트 메뉴 오버레이) 를 생략하고 captureFromTarget 만 수행
      if (!action.captureFromTarget || !action.selector) return;
      if (!ctx.lectureId) {
        throw new Error(
          `right_click.captureFromTarget 실행에는 lectureId 가 필요합니다 (saveAs=${action.captureFromTarget.saveAs})`,
        );
      }
      const attr = action.captureFromTarget.attribute ?? 'src';
      const loc = page.locator(action.selector);
      await loc.waitFor({ state: 'attached', timeout: 10000 });
      const value = await loc.getAttribute(attr);
      if (value === null) {
        throw new Error(
          `right_click.captureFromTarget: selector ${action.selector} 의 ${attr} attribute 가 null 입니다`,
        );
      }
      const transformed = applyCaptureTransform(value, action.captureFromTarget.transform);
      await saveCapture(
        ctx.lectureId,
        action.captureFromTarget.saveAs,
        transformed,
        { sceneId: ctx.sceneId, sourceCmd: 'right_click' },
      );
      return;
    }
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
  throw new Error(`Claude 응답 대기 타임아웃 (${timeoutMs}ms) — 페이지 상태 불확실, 세션 중단`);
}
