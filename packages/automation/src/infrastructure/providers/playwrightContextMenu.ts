import { Page } from 'playwright';
import { ContextMenuItem } from '../../domain/entities/Lecture';

/**
 * Playwright `right_click` 액션이 화면에 띄우는 가짜 컨텍스트 메뉴 오버레이.
 *
 * SSoT 목적:
 *   - playwrightStepExecutor (state-capture 모드)
 *   - PlaywrightVisualProvider (raw video 모드)
 * 두 경로가 같은 메뉴 렌더링 로직을 공유한다. 새 액션 추가나 스타일 변경 시
 * 이 파일만 고친다.
 *
 * SRP: 컨텍스트 메뉴의 시각 효과(주입/제거)만 담당한다. 클릭 항목 결정,
 *      capture 추출, placeholder 치환 같은 책임은 이 모듈에 들이지 않는다.
 */

const CONTEXT_MENU_ELEMENT_ID = '__playwright_context_menu__';

export interface ContextMenuRenderItem {
  label: string;
  highlighted: boolean;
  separator: boolean;
}

/**
 * 액션 정의의 ContextMenuItem 배열을 렌더링용 정규화 항목으로 변환한다.
 * clickItem 이 일치하면 자동으로 highlighted 처리.
 */
export function normalizeContextMenuItems(
  items: ContextMenuItem[],
  clickItem: string | undefined,
): ContextMenuRenderItem[] {
  return items.map((item) => {
    if (typeof item === 'string') {
      return {
        label: item,
        highlighted: clickItem !== undefined && item === clickItem,
        separator: false,
      };
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

/**
 * 페이지에 컨텍스트 메뉴 오버레이를 주입한다.
 * 같은 페이지에 이미 동일 id 의 메뉴가 있으면 제거 후 다시 그린다.
 */
export async function injectContextMenu(
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

/** 페이지에서 컨텍스트 메뉴 오버레이를 제거한다. 없으면 no-op. */
export async function removeContextMenu(page: Page): Promise<void> {
  await page.evaluate((elementId) => {
    document.getElementById(elementId)?.remove();
  }, CONTEXT_MENU_ELEMENT_ID);
}
