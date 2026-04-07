import { Page } from 'playwright';
import { PlaywrightAction } from '../../domain/entities/Lecture';
import { EDU_DEVTOOLS_ACTION_DURATION_MS } from '../../domain/constants/EduDevtoolsActionDurations';

export type EduDevtoolsToggleMode = 'toggle' | 'expand' | 'collapse';

export interface EduDevtoolsCommandArgs {
  command: 'open' | 'select-node' | 'toggle-node';
  selector?: string;
  mode?: EduDevtoolsToggleMode;
}

export interface EduDevtoolsCommandResult {
  ok: boolean;
  path?: string;
  reason?: string;
}

type SupportedEduDevtoolsAction = Pick<PlaywrightAction, 'cmd' | 'selector' | 'mode'>;

export function getEduDevtoolsActionDuration(cmd: PlaywrightAction['cmd']): number | null {
  return EDU_DEVTOOLS_ACTION_DURATION_MS[cmd] ?? null;
}

export function toEduDevtoolsCommandArgs(action: SupportedEduDevtoolsAction): EduDevtoolsCommandArgs | null {
  switch (action.cmd) {
    case 'open_devtools':
      return { command: 'open' };
    case 'select_devtools_node':
      return { command: 'select-node', selector: action.selector };
    case 'toggle_devtools_node':
      return { command: 'toggle-node', selector: action.selector, mode: action.mode };
    default:
      return null;
  }
}

export async function executeEduDevtoolsAction(page: Page, action: SupportedEduDevtoolsAction): Promise<EduDevtoolsCommandResult | null> {
  const args = toEduDevtoolsCommandArgs(action);
  if (!args) return null;
  return page.evaluate(runEduDevtoolsCommand, args);
}

/**
 * Browser-context helper for the educational DevTools overlay.
 *
 * IMPORTANT:
 * - This function must stay self-contained because Playwright serializes the
 *   function source when passed to page.evaluate().
 * - Do not reference outer-scope variables from inside this function.
 */
export function runEduDevtoolsCommand(args: EduDevtoolsCommandArgs): EduDevtoolsCommandResult {
  type DevtoolsState = {
    selectedPath: string | null;
    expandedPaths: string[];
    focusPath: string | null;
  };

  type HighlightSnapshotElement = HTMLElement & {
    __eduPrevOutline?: string;
    __eduPrevOutlineOffset?: string;
  };

  const DEVTOOLS_ID = '__edu_devtools__';
  const TREE_ID = '__edu_devtools_tree__';
  const STYLES_ID = '__edu_devtools_styles__';
  const WRAPPER_ID = '__edu_site_wrapper__';
  const MAX_DEPTH = 6;
  const AUTO_FOCUS_DEPTH = 4;
  const MAX_FOCUS_CANDIDATES = 2;
  const MAX_SCAN_NODES = 160;

  const win = window as Window & {
    __eduDevtoolsState__?: DevtoolsState;
    __eduHighlightedElement__?: HighlightSnapshotElement | null;
  };

  function escHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function isEduElement(node: Element | null): boolean {
    if (!node) return false;
    const id = node.id || '';
    return id.startsWith('__edu');
  }

  function ensureState(): DevtoolsState {
    if (!win.__eduDevtoolsState__) {
      win.__eduDevtoolsState__ = {
        selectedPath: null,
        expandedPaths: [''],
        focusPath: null,
      };
    }
    return win.__eduDevtoolsState__;
  }

  function sanitizeStyleAttribute(el: Element, value: string): string {
    const declarations = value
      .split(';')
      .map(part => part.trim())
      .filter(Boolean);

    const filtered = declarations.filter(part => {
      const normalized = part.replace(/\s+/g, ' ').toLowerCase();
      if (el === document.body && (normalized === 'overflow: hidden' || normalized === 'margin: 0' || normalized === 'margin: 0px')) {
        return false;
      }
      return true;
    });

    return filtered.join('; ');
  }

  function getRenderableAttributes(el: Element): Array<{ name: string; value: string }> {
    return Array.from(el.attributes).flatMap(attr => {
      if (attr.name.startsWith('data-__edu') || attr.name.startsWith('data-edu-')) {
        return [];
      }

      let value = attr.value;
      if (attr.name === 'style') {
        value = sanitizeStyleAttribute(el, value);
      }

      if (!value) {
        return attr.name === 'style' ? [] : [{ name: attr.name, value: '' }];
      }

      return [{ name: attr.name, value }];
    });
  }

  function hasMeaningfulText(el: Element): boolean {
    const text = (el.textContent ?? '').replace(/\s+/g, ' ').trim();
    return text.length >= 2;
  }

  function isTechnicalTag(tag: string): boolean {
    return [
      'script',
      'style',
      'link',
      'meta',
      'noscript',
      'template',
      'svg',
      'path',
      'use',
      'defs',
      'symbol',
      'g',
      'mask',
      'clippath',
      'source',
      'track',
      'canvas',
    ].includes(tag);
  }

  function getTagTeachingScore(tag: string): number {
    switch (tag) {
      case 'main':
      case 'header':
      case 'nav':
      case 'section':
      case 'article':
      case 'form':
      case 'footer':
        return 95;
      case 'h1':
      case 'h2':
      case 'h3':
      case 'p':
      case 'button':
      case 'input':
      case 'textarea':
      case 'select':
      case 'img':
      case 'picture':
      case 'video':
        return 82;
      case 'a':
      case 'ul':
      case 'ol':
      case 'li':
      case 'figure':
        return 68;
      case 'div':
      case 'span':
        return 50;
      case 'body':
      case 'head':
        return 36;
      case 'iframe':
        return 8;
      case 'script':
      case 'style':
      case 'link':
      case 'meta':
      case 'noscript':
      case 'template':
        return -40;
      default:
        return 30;
    }
  }

  function getElementTeachingScore(el: Element, depthFromRoot = 0): number {
    const tag = el.tagName.toLowerCase();
    let score = getTagTeachingScore(tag) - depthFromRoot * 4;
    const text = (el.textContent ?? '').replace(/\s+/g, ' ').trim();

    if (text) {
      score += Math.min(18, Math.ceil(text.length / 12));
    }
    if (el.id) {
      score += 10;
    }
    if (el.classList.length > 0) {
      score += Math.min(12, el.classList.length * 4);
    }
    if (el instanceof HTMLElement) {
      if (el.hidden || el.getAttribute('aria-hidden') === 'true') {
        score -= 24;
      }
      if (el.offsetWidth === 0 && el.offsetHeight === 0 && !hasMeaningfulText(el)) {
        score -= 10;
      }
    }
    if (isTechnicalTag(tag)) {
      score -= 18;
    }

    return score;
  }

  function ensureSiteWrapper(): void {
    if (document.getElementById(WRAPPER_ID)) return;

    const siteWidthPx = Math.round(window.innerWidth * 0.62);
    const wrapper = document.createElement('div');
    wrapper.id = WRAPPER_ID;
    wrapper.style.cssText = [
      'position:fixed',
      'left:0',
      'top:0',
      'width:' + siteWidthPx + 'px',
      'height:100vh',
      'overflow-y:auto',
      'overflow-x:hidden',
      'z-index:1',
    ].join(';');

    const movableNodes = Array.from(document.body.childNodes).filter(node => {
      return !(node instanceof Element && isEduElement(node));
    });

    for (const node of movableNodes) {
      wrapper.appendChild(node);
    }

    document.body.appendChild(wrapper);
    document.body.style.overflow = 'hidden';
    document.body.style.margin = '0';
  }

  function getVirtualChildren(el: Element): Element[] {
    if (el === document.body) {
      const children: Element[] = [];
      for (const child of Array.from(document.body.children)) {
        if (child.id === WRAPPER_ID) {
          for (const wrapped of Array.from(child.children)) {
            if (!isEduElement(wrapped)) {
              children.push(wrapped);
            }
          }
          continue;
        }
        if (isEduElement(child)) continue;
        children.push(child);
      }
      return children;
    }

    return Array.from(el.children).filter(child => !isEduElement(child));
  }

  function getVirtualParent(el: Element): Element | null {
    const parent = el.parentElement;
    if (!parent) return null;
    if (parent.id === WRAPPER_ID) return document.body;
    return parent;
  }

  function getPathSegments(path: string): number[] {
    if (!path) return [];
    return path.split('.').map(part => Number(part)).filter(num => Number.isFinite(num));
  }

  function getNodePath(el: Element): string | null {
    if (el === document.documentElement) return '';
    const parts: number[] = [];
    let current: Element | null = el;

    while (current && current !== document.documentElement) {
      const parent = getVirtualParent(current);
      if (!parent) return null;
      const siblings = getVirtualChildren(parent);
      const index = siblings.indexOf(current);
      if (index === -1) return null;
      parts.unshift(index);
      current = parent;
    }

    return parts.join('.');
  }

  function getElementByPath(path: string): Element | null {
    let current: Element = document.documentElement;
    for (const segment of getPathSegments(path)) {
      const children = getVirtualChildren(current);
      const next = children[segment];
      if (!next) return null;
      current = next;
    }
    return current;
  }

  function uniquePaths(paths: string[]): string[] {
    return Array.from(new Set(paths));
  }

  function isSameOrAncestorPath(candidate: string, target: string): boolean {
    if (candidate === '') return true;
    return target === candidate || target.startsWith(candidate + '.');
  }

  function getAncestorPaths(path: string): string[] {
    if (!path) return [''];
    const parts = path.split('.');
    const ancestors = [''];
    let current = '';
    for (let i = 0; i < parts.length - 1; i++) {
      current = current ? `${current}.${parts[i]}` : parts[i];
      ancestors.push(current);
    }
    return ancestors;
  }

  function getExpandedTrail(path: string): string[] {
    return uniquePaths([...getAncestorPaths(path), path]);
  }

  function getNextFocusIndex(currentPath: string, focusPath: string | null): number | null {
    if (!focusPath) return null;
    const currentParts = getPathSegments(currentPath);
    const focusParts = getPathSegments(focusPath);
    if (currentParts.length >= focusParts.length) return null;
    for (let i = 0; i < currentParts.length; i++) {
      if (currentParts[i] !== focusParts[i]) return null;
    }
    return focusParts[currentParts.length] ?? null;
  }

  function pickVisibleChildren(el: Element, path: string, depth: number, focusPath: string | null): Array<{ child: Element; index: number }> {
    const children = getVirtualChildren(el);
    const indexedChildren = children.map((child, index) => ({ child, index }));
    const maxChildren = depth <= 1 ? 12 : 8;

    if (indexedChildren.length <= maxChildren) {
      return indexedChildren;
    }

    const focusIndex = getNextFocusIndex(path, focusPath);
    const guaranteedLeadingCount = Math.min(depth <= 1 ? 4 : 3, indexedChildren.length);
    const visibleIndexes = new Set<number>();

    for (let index = 0; index < guaranteedLeadingCount; index++) {
      visibleIndexes.add(index);
    }
    if (focusIndex !== null) {
      visibleIndexes.add(focusIndex);
    }

    const rankedChildren = indexedChildren
      .map(({ child, index }) => ({
        child,
        index,
        score: getElementTeachingScore(child, depth + 1),
      }))
      .sort((a, b) => b.score - a.score || a.index - b.index);

    for (const candidate of rankedChildren) {
      if (visibleIndexes.size >= maxChildren) break;
      visibleIndexes.add(candidate.index);
    }

    return indexedChildren.filter(({ index }) => visibleIndexes.has(index)).sort((a, b) => a.index - b.index);
  }

  function getTopLevelBranchKey(path: string, rootPath: string): string {
    const rootSegments = getPathSegments(rootPath);
    const pathSegments = getPathSegments(path);
    const branchIndex = pathSegments[rootSegments.length];
    return branchIndex === undefined ? path : String(branchIndex);
  }

  function getTeachingFocusPaths(root: Element, rootPath: string): string[] {
    const queue = getVirtualChildren(root).map((child, index) => ({
      child,
      path: rootPath ? `${rootPath}.${index}` : String(index),
      depth: 1,
    }));

    const candidates: Array<{ path: string; depth: number; score: number; branchKey: string }> = [];
    let scannedNodes = 0;

    while (queue.length > 0 && scannedNodes < MAX_SCAN_NODES) {
      const current = queue.shift();
      if (!current) break;
      scannedNodes += 1;

      const { child, path, depth } = current;
      const score = getElementTeachingScore(child, depth) + (getVirtualChildren(child).length > 0 ? 6 : 0);
      const tag = child.tagName.toLowerCase();

      if (!isTechnicalTag(tag) || score >= 40) {
        candidates.push({
          path,
          depth,
          score,
          branchKey: getTopLevelBranchKey(path, rootPath),
        });
      }

      if (depth >= AUTO_FOCUS_DEPTH) {
        continue;
      }

      const nextChildren = getVirtualChildren(child);
      nextChildren.forEach((grandChild, index) => {
        queue.push({
          child: grandChild,
          path: `${path}.${index}`,
          depth: depth + 1,
        });
      });
    }

    const ranked = candidates.sort((a, b) => b.score - a.score || a.depth - b.depth || a.path.localeCompare(b.path));
    const selectedPaths: string[] = [];
    const usedBranches = new Set<string>();

    for (const candidate of ranked) {
      if (selectedPaths.length >= MAX_FOCUS_CANDIDATES) break;
      if (usedBranches.has(candidate.branchKey)) continue;
      usedBranches.add(candidate.branchKey);
      selectedPaths.push(candidate.path);
    }

    return selectedPaths;
  }

  function renderAttrs(el: Element): string {
    return getRenderableAttributes(el)
      .slice(0, 3)
      .map(({ name, value }) => {
        const truncated = value.length > 40 ? value.substring(0, 40) + '…' : value;
        return ` <span class="__edu_dt_attr">${escHtml(name)}</span>=<span class="__edu_dt_attr_value">"${escHtml(truncated)}"</span>`;
      })
      .join('');
  }

  function renderNode(el: Element, path: string, depth: number, focusPath: string | null): string {
    const isAlongFocus = focusPath ? isSameOrAncestorPath(path, focusPath) : false;
    if (depth > MAX_DEPTH && !isAlongFocus) return '';

    const state = ensureState();
    const tag = el.tagName.toLowerCase();
    const attrs = renderAttrs(el);
    const indent = depth * 14;
    const children = getVirtualChildren(el);
    const hasChildren = children.length > 0;
    const isExpanded = hasChildren && state.expandedPaths.includes(path);
    const isSelected = state.selectedPath === path;
    const text = hasChildren ? '' : (el.textContent?.trim() ?? '').slice(0, 50);
    const visibleChildren = isExpanded ? pickVisibleChildren(el, path, depth, focusPath) : [];
    const hiddenCount = isExpanded ? children.length - visibleChildren.length : 0;

    const rowClass = [
      '__edu_dt_row',
      isSelected ? 'is-selected' : '',
      hasChildren ? 'has-children' : 'is-leaf',
    ].filter(Boolean).join(' ');

    const openingRow =
      `<div class="${rowClass}" data-node-path="${path}" style="padding-left:${indent}px">` +
        `<span class="__edu_dt_toggle">${hasChildren ? (isExpanded ? '▼' : '▶') : ' '}</span>` +
        `<span class="__edu_dt_tag">&lt;${tag}</span>${attrs}<span class="__edu_dt_tag">&gt;</span>` +
        (text ? `<span class="__edu_dt_text">${escHtml(text)}</span>` : '') +
        (!hasChildren ? `<span class="__edu_dt_tag">&lt;/${tag}&gt;</span>` : '') +
      `</div>`;

    if (!hasChildren || !isExpanded) {
      return openingRow;
    }

    const childHtml = visibleChildren
      .map(({ child, index }) => {
        const childPath = path ? `${path}.${index}` : String(index);
        return renderNode(child, childPath, depth + 1, focusPath);
      })
      .join('');

    const moreRow = hiddenCount > 0
      ? `<div class="__edu_dt_more" style="padding-left:${indent + 14}px">… ${hiddenCount} more element(s)</div>`
      : '';

    const closingRow =
      `<div class="__edu_dt_row __edu_dt_closing" style="padding-left:${indent}px">` +
        `<span class="__edu_dt_toggle"> </span>` +
        `<span class="__edu_dt_tag">&lt;/${tag}&gt;</span>` +
      `</div>`;

    return openingRow + childHtml + moreRow + closingRow;
  }

  function ensureOverlay(): HTMLElement {
    let overlay = document.getElementById(DEVTOOLS_ID);
    if (overlay) return overlay;

    overlay = document.createElement('div');
    overlay.id = DEVTOOLS_ID;
    overlay.style.cssText = [
      'position:fixed',
      'right:0',
      'top:0',
      'bottom:0',
      'width:38%',
      'z-index:2147483647',
      'display:flex',
      'flex-direction:column',
      'box-shadow:-4px 0 20px rgba(0,0,0,0.7)',
      'animation:__dt_slide 0.25s ease-out',
    ].join(';');

    overlay.innerHTML = `
      <style>
        @keyframes __dt_slide {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        #${DEVTOOLS_ID}, #${DEVTOOLS_ID} * { box-sizing: border-box; }
        #${DEVTOOLS_ID} * { margin: 0; padding: 0; }
        #${DEVTOOLS_ID} .__edu_dt_row {
          min-height: 20px;
          line-height: 20px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          color: #d4d4d4;
        }
        #${DEVTOOLS_ID} .__edu_dt_row.is-selected {
          background: rgba(74, 158, 255, 0.28);
          box-shadow: inset 2px 0 0 #4a9eff;
        }
        #${DEVTOOLS_ID} .__edu_dt_row.__edu_dt_closing {
          color: #9aa0a6;
        }
        #${DEVTOOLS_ID} .__edu_dt_toggle {
          display: inline-block;
          width: 14px;
          color: #6a9955;
          text-align: center;
          margin-right: 2px;
        }
        #${DEVTOOLS_ID} .__edu_dt_tag {
          color: #4ec9b0;
        }
        #${DEVTOOLS_ID} .__edu_dt_attr {
          color: #9cdcfe;
        }
        #${DEVTOOLS_ID} .__edu_dt_attr_value {
          color: #ce9178;
        }
        #${DEVTOOLS_ID} .__edu_dt_text {
          color: #d4d4d4;
          margin-left: 4px;
        }
        #${DEVTOOLS_ID} .__edu_dt_more {
          color: #9aa0a6;
          line-height: 18px;
          font-style: italic;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
      </style>
      <div style="display:flex;align-items:center;background:#2b2b2b;border-left:1px solid #3c3c3c;border-bottom:1px solid #3c3c3c;height:32px;flex-shrink:0;overflow:hidden">
        <div style="display:flex;height:100%">
          <div style="color:#fff;background:#1e1e1e;border-top:2px solid #4a9eff;padding:0 12px;font-size:12px;font-family:-apple-system,BlinkMacSystemFont,sans-serif;display:flex;align-items:center">Elements</div>
          <div style="color:#9aa0a6;padding:0 12px;font-size:12px;font-family:-apple-system,BlinkMacSystemFont,sans-serif;display:flex;align-items:center">Console</div>
          <div style="color:#9aa0a6;padding:0 12px;font-size:12px;font-family:-apple-system,BlinkMacSystemFont,sans-serif;display:flex;align-items:center">Sources</div>
          <div style="color:#9aa0a6;padding:0 12px;font-size:12px;font-family:-apple-system,BlinkMacSystemFont,sans-serif;display:flex;align-items:center">Network</div>
        </div>
        <div style="margin-left:auto;padding:0 12px;color:#9aa0a6;font-size:20px;display:flex;align-items:center;height:100%">⋮</div>
      </div>
      <div style="display:flex;flex:1;overflow:hidden;background:#1e1e1e;font-family:Menlo,Consolas,'Courier New',monospace;font-size:12px;color:#d4d4d4;border-left:1px solid #3c3c3c">
        <div id="${TREE_ID}" style="flex:1;overflow:auto;padding:4px 0 4px 4px"></div>
        <div id="${STYLES_ID}" style="width:200px;border-left:1px solid #3c3c3c;overflow:auto;padding:8px;flex-shrink:0">
          <div style="color:#9aa0a6;font-size:11px;font-family:-apple-system,sans-serif;padding-bottom:6px;border-bottom:1px solid #3c3c3c;margin-bottom:8px">Styles&nbsp;&nbsp;Computed</div>
          <div style="margin-bottom:2px"><span style="color:#a8c7fa">element</span><span style="color:#9aa0a6">.style {</span></div>
          <div style="color:#9aa0a6;margin-bottom:10px">}</div>
          <div style="color:#9aa0a6;margin-bottom:4px">body {</div>
          <div style="padding-left:14px;margin-bottom:2px"><span style="color:#9cdcfe">font-family</span>: <span style="color:#ce9178">-apple-system</span>;</div>
          <div style="padding-left:14px;margin-bottom:2px"><span style="color:#9cdcfe">margin</span>: <span style="color:#b5cea8">0</span>;</div>
          <div style="padding-left:14px;margin-bottom:2px"><span style="color:#9cdcfe">padding</span>: <span style="color:#b5cea8">0</span>;</div>
          <div style="color:#9aa0a6;margin-bottom:10px">}</div>
          <div style="color:#9aa0a6;margin-bottom:4px">*, *::before {</div>
          <div style="padding-left:14px;margin-bottom:2px"><span style="color:#9cdcfe">box-sizing</span>: <span style="color:#ce9178">border-box</span>;</div>
          <div style="color:#9aa0a6;margin-bottom:10px">}</div>
          <div style="color:#9aa0a6;margin-bottom:4px">a {</div>
          <div style="padding-left:14px;margin-bottom:2px"><span style="color:#9cdcfe">color</span>: <span style="color:#ce9178">inherit</span>;</div>
          <div style="padding-left:14px;margin-bottom:2px"><span style="color:#9cdcfe">text-decoration</span>: <span style="color:#ce9178">none</span>;</div>
          <div style="color:#9aa0a6">}</div>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    return overlay;
  }

  function renderOverlay(focusPath: string | null = null): void {
    ensureOverlay();
    const tree = document.getElementById(TREE_ID);
    if (!tree) return;
    const state = ensureState();
    const activeFocusPath = focusPath ?? state.focusPath ?? state.selectedPath;
    tree.innerHTML = renderNode(document.documentElement, '', 0, activeFocusPath);

    const selectedPath = state.selectedPath;
    if (!selectedPath) return;
    const row = tree.querySelector(`[data-node-path="${selectedPath}"]`) as HTMLElement | null;
    const shouldKeepChildrenVisible = Boolean(activeFocusPath && activeFocusPath !== selectedPath);
    row?.scrollIntoView({ block: shouldKeepChildrenVisible ? 'start' : 'center' });
  }

  function clearHighlightedElement(): void {
    const prev = win.__eduHighlightedElement__;
    if (!prev) return;
    prev.style.outline = prev.__eduPrevOutline || '';
    prev.style.outlineOffset = prev.__eduPrevOutlineOffset || '';
    delete prev.__eduPrevOutline;
    delete prev.__eduPrevOutlineOffset;
    win.__eduHighlightedElement__ = null;
  }

  function highlightElement(el: Element): void {
    clearHighlightedElement();

    let target = el as HighlightSnapshotElement;
    if (el === document.body) {
      const wrapper = document.getElementById(WRAPPER_ID);
      if (wrapper instanceof HTMLElement) {
        target = wrapper as HighlightSnapshotElement;
      }
    }

    if (!(target instanceof HTMLElement)) return;
    target.__eduPrevOutline = target.style.outline;
    target.__eduPrevOutlineOffset = target.style.outlineOffset;
    target.style.outline = '4px solid #4a9eff';
    target.style.outlineOffset = '2px';
    win.__eduHighlightedElement__ = target;
  }

  function resolveTargetPath(selector?: string): { target: Element | null; path: string | null; reason?: string } {
    const state = ensureState();

    if (!selector) {
      if (!state.selectedPath) {
        return { target: null, path: null, reason: 'No selector and no selected node' };
      }
      const selected = getElementByPath(state.selectedPath);
      return {
        target: selected,
        path: state.selectedPath,
        reason: selected ? undefined : 'Selected node no longer exists',
      };
    }

    const target = document.querySelector(selector);
    if (!(target instanceof Element)) {
      return { target: null, path: null, reason: `Selector not found: ${selector}` };
    }

    const path = getNodePath(target);
    if (path === null) {
      return { target, path: null, reason: 'Target is outside the educational DOM tree' };
    }

    return { target, path };
  }

  function selectNode(selector?: string): EduDevtoolsCommandResult {
    const state = ensureState();
    const resolved = resolveTargetPath(selector);
    if (!resolved.target || resolved.path === null) {
      return { ok: false, reason: resolved.reason };
    }

    const focusPaths = getTeachingFocusPaths(resolved.target, resolved.path);
    state.selectedPath = resolved.path;
    state.focusPath = focusPaths[0] ?? resolved.path;
    state.expandedPaths = uniquePaths([
      '',
      ...getExpandedTrail(resolved.path),
      ...focusPaths.flatMap(getExpandedTrail),
    ]);
    renderOverlay(state.focusPath);
    highlightElement(resolved.target);
    return { ok: true, path: resolved.path };
  }

  function toggleNode(selector?: string, mode: EduDevtoolsToggleMode = 'toggle'): EduDevtoolsCommandResult {
    const state = ensureState();
    const resolved = resolveTargetPath(selector);
    if (!resolved.target || resolved.path === null) {
      return { ok: false, reason: resolved.reason };
    }

    const path = resolved.path;
    const isExpanded = state.expandedPaths.includes(path);
    const nextMode = mode === 'toggle'
      ? (isExpanded ? 'collapse' : 'expand')
      : mode;

    if (nextMode === 'expand') {
      const focusPaths = getTeachingFocusPaths(resolved.target, path);
      state.focusPath = focusPaths[0] ?? state.focusPath ?? path;
      state.expandedPaths = uniquePaths([
        ...state.expandedPaths,
        ...getExpandedTrail(path),
        ...focusPaths.flatMap(getExpandedTrail),
      ]);
    } else {
      state.expandedPaths = state.expandedPaths.filter(candidate => candidate !== path && !candidate.startsWith(path + '.'));
      state.expandedPaths = uniquePaths(['', ...state.expandedPaths]);
      if (state.selectedPath && state.selectedPath.startsWith(path + '.')) {
        state.selectedPath = path;
      }
      if (state.focusPath && (state.focusPath === path || state.focusPath.startsWith(path + '.'))) {
        state.focusPath = path;
      }
    }

    state.selectedPath = state.selectedPath ?? path;
    renderOverlay(state.focusPath ?? state.selectedPath);
    highlightElement(resolved.target);
    return { ok: true, path };
  }

  ensureSiteWrapper();
  ensureState();

  switch (args.command) {
    case 'open':
      ensureOverlay();
      renderOverlay();
      return { ok: true };
    case 'select-node':
      return selectNode(args.selector);
    case 'toggle-node':
      return toggleNode(args.selector, args.mode ?? 'toggle');
    default:
      return { ok: false, reason: 'Unknown command' };
  }
}
