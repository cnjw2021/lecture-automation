import { PlaywrightAction } from '../entities/Lecture';
import { EDU_DEVTOOLS_ACTION_DURATION_MS } from '../constants/EduDevtoolsActionDurations';

/**
 * Playwright forward-sync budget SSoT.
 *
 * 값 산출 기준: PlaywrightVisualProvider 의 직접적인 waitForTimeout 만이 아니라
 * 실제 녹화 manifest 의 액션 완료 timestamp 를 반영한 실측 budget.
 *
 * 예: mouseMoveMs=800
 *   - PlaywrightVisualProvider:439-440 코드만 보면 `mouse.move({steps:30}) + waitForTimeout(200)` 이라
 *     단순 합산으로는 ~200ms 처럼 보이지만, headed 모드에서 30 step CDP 디스패치 + 커서 div
 *     렌더링/애니메이션 + 브라우저 paint 까지 포함한 실측 평균이 ~800ms.
 *   - 보수적 budget 으로 두면 syncPoint 가 narration 보다 빨리 발화되는 케이스가 줄어든다.
 *   - 값을 줄이면 wait 가 과다 분배되어 마지막 segment 에 무음 꼬리가 남기 쉬움.
 *
 * 다른 액션도 같은 원칙: provider 의 명시적 waitForTimeout 이 아니라 실제 녹화 길이에 맞춤.
 */
export const PLAYWRIGHT_TIMING = {
  typeDelayMsPerChar: 100,
  mouseMoveMs: 800,
  clickMs: 500,
  pressMs: 100,
  focusMs: 100,
  mouseDragMs: 1000,
  highlightMs: 1500,
  scrollMs: 500,
  cssToggleMs: 300,
  /** right_click 의 기본 visible duration (mouse_move + 메뉴 표시) */
  rightClickBaseMs: 1500,
  /** right_click.showContextMenu.clickItem 사용 시 추가되는 highlight→click 연출 시간 */
  rightClickItemDelayMs: 800,
  waitForMs: 0,
  defaultGotoMs: 3000,
  codePenGotoMs: 4200,
  prefillCodepenMs: 4500,
  yahooGotoMs: 7000,
  heavyGotoMs: 6000,
  setupFloorSlackMs: 1000,
  segmentSlackMs: 1000,
} as const;

export interface ActionDurationEstimate {
  ms: number;
  basis: string;
}

/**
 * Forward-sync budget estimate for non-wait Playwright actions.
 * Values intentionally mirror PlaywrightVisualProvider's visible execution path.
 */
export function estimatePlaywrightActionDurationMs(action: PlaywrightAction): ActionDurationEstimate {
  if (action.offscreen) return { ms: 0, basis: 'offscreen' };

  switch (action.cmd) {
    case 'wait':
      return { ms: Math.max(0, action.ms ?? 0), basis: 'wait ms' };
    case 'goto':
      return estimateGotoDurationMs(action);
    case 'prefill_codepen':
      return { ms: PLAYWRIGHT_TIMING.prefillCodepenMs, basis: 'CodePen Prefill POST + pen page load' };
    case 'type': {
      const charCount = action.key?.length ?? 0;
      return {
        ms: charCount * PLAYWRIGHT_TIMING.typeDelayMsPerChar,
        basis: `${charCount} chars x ${PLAYWRIGHT_TIMING.typeDelayMsPerChar}ms`,
      };
    }
    case 'mouse_move':
      return {
        ms: PLAYWRIGHT_TIMING.mouseMoveMs,
        basis: 'manifest empirical: steps 30 CDP dispatch + cursor div animation + paint',
      };
    case 'click':
      return { ms: PLAYWRIGHT_TIMING.clickMs, basis: 'locator click' };
    case 'press':
      return { ms: PLAYWRIGHT_TIMING.pressMs, basis: 'keyboard press' };
    case 'focus':
      return { ms: PLAYWRIGHT_TIMING.focusMs, basis: 'locator focus' };
    case 'mouse_drag':
      return { ms: PLAYWRIGHT_TIMING.mouseDragMs, basis: 'mouse drag' };
    case 'highlight':
      return { ms: PLAYWRIGHT_TIMING.highlightMs, basis: 'highlight auto-clear' };
    case 'scroll':
      return { ms: PLAYWRIGHT_TIMING.scrollMs, basis: 'wheel + settle' };
    case 'disable_css':
    case 'enable_css':
      return { ms: PLAYWRIGHT_TIMING.cssToggleMs, basis: 'css toggle settle' };
    case 'wait_for':
    case 'wait_for_claude_ready':
      return { ms: PLAYWRIGHT_TIMING.waitForMs, basis: 'condition-dependent wait excluded' };
    case 'open_devtools':
    case 'select_devtools_node':
    case 'toggle_devtools_node':
      return {
        ms: EDU_DEVTOOLS_ACTION_DURATION_MS[action.cmd] ?? 0,
        basis: 'edu devtools duration',
      };
    case 'render_code_block':
      return { ms: 0, basis: 'not timed for forward sync' };
    case 'capture':
      return { ms: 0, basis: 'capture has no visible effect' };
    case 'right_click': {
      const highlightDelay = action.showContextMenu?.highlightDelayMs ?? 0;
      const clickItemDelay = action.showContextMenu?.clickItem
        ? (action.showContextMenu.clickDelayMs ?? PLAYWRIGHT_TIMING.rightClickItemDelayMs)
        : 0;
      return {
        ms: PLAYWRIGHT_TIMING.rightClickBaseMs + highlightDelay + clickItemDelay,
        basis: 'right_click base + menu highlight delay + clickItem delay',
      };
    }
    default:
      return { ms: 0, basis: 'unknown action' };
  }
}

export function estimateFixedActionDurationMs(action: PlaywrightAction): ActionDurationEstimate {
  if (action.cmd === 'wait') return { ms: 0, basis: 'wait is adjustable' };
  return estimatePlaywrightActionDurationMs(action);
}

export function estimateActionsDurationMs(actions: PlaywrightAction[], options: { includeWait?: boolean } = {}): number {
  return actions.reduce((sum, action) => {
    if (action.offscreen) return sum;
    if (action.cmd === 'wait' && !options.includeWait) return sum;
    const estimate = options.includeWait
      ? estimatePlaywrightActionDurationMs(action)
      : estimateFixedActionDurationMs(action);
    return sum + estimate.ms;
  }, 0);
}

function estimateGotoDurationMs(action: PlaywrightAction): ActionDurationEstimate {
  const url = action.url ?? '';
  const lower = url.toLowerCase();

  if (lower.includes('codepen.io')) {
    return { ms: PLAYWRIGHT_TIMING.codePenGotoMs, basis: 'CodePen observed load budget' };
  }
  if (lower.includes('yahoo.')) {
    return { ms: PLAYWRIGHT_TIMING.yahooGotoMs, basis: 'Yahoo observed load budget' };
  }
  if (
    lower.includes('claude.ai') ||
    lower.includes('chatgpt.com') ||
    lower.includes('openai.com') ||
    lower.includes('apple.com')
  ) {
    return { ms: PLAYWRIGHT_TIMING.heavyGotoMs, basis: 'heavy app load budget' };
  }
  if (action.urlFromScene !== undefined) {
    return { ms: PLAYWRIGHT_TIMING.defaultGotoMs, basis: 'urlFromScene fallback load budget' };
  }

  return { ms: PLAYWRIGHT_TIMING.defaultGotoMs, basis: 'default load budget' };
}
