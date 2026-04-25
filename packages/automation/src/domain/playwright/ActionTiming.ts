import { PlaywrightAction } from '../entities/Lecture';
import { EDU_DEVTOOLS_ACTION_DURATION_MS } from '../constants/EduDevtoolsActionDurations';

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
  waitForMs: 0,
  defaultGotoMs: 3000,
  codePenGotoMs: 4200,
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
    case 'type': {
      const charCount = action.key?.length ?? 0;
      return {
        ms: charCount * PLAYWRIGHT_TIMING.typeDelayMsPerChar,
        basis: `${charCount} chars x ${PLAYWRIGHT_TIMING.typeDelayMsPerChar}ms`,
      };
    }
    case 'mouse_move':
      return { ms: PLAYWRIGHT_TIMING.mouseMoveMs, basis: 'steps 30 + cursor settle' };
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
