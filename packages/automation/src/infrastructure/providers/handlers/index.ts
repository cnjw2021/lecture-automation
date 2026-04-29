/**
 * Playwright 액션 핸들러 registry (#144 Phase 0d).
 *
 * 새 cmd 를 추가할 때:
 *   1) handlers/{newCmd}Handler.ts 신규 작성
 *   2) 본 파일에 import + ALL_HANDLERS 배열에 한 줄 추가
 *   3) docs/playwright-actions.md 갱신
 *
 * StepExecutor / VisualProvider 와 lint 룰은 자동으로 새 cmd 를 인식한다 (Phase 0e).
 */

import { PlaywrightCmd } from '../../../domain/entities/Lecture';
import { PlaywrightActionHandler } from '../../../domain/playwright/PlaywrightActionHandler';

import { gotoHandler } from './gotoHandler';
import { prefillCodepenHandler } from './prefillCodepenHandler';
import { waitHandler } from './waitHandler';
import { waitForHandler } from './waitForHandler';
import { waitForClaudeReadyHandler } from './waitForClaudeReadyHandler';
import { scrollHandler } from './scrollHandler';
import { mouseMoveHandler } from './mouseMoveHandler';
import { clickHandler } from './clickHandler';
import { typeHandler } from './typeHandler';
import { focusHandler } from './focusHandler';
import { mouseDragHandler } from './mouseDragHandler';
import { pressHandler } from './pressHandler';
import { highlightHandler } from './highlightHandler';
import {
  openDevtoolsHandler,
  selectDevtoolsNodeHandler,
  toggleDevtoolsNodeHandler,
} from './eduDevtoolsHandlers';
import { disableCssHandler } from './disableCssHandler';
import { enableCssHandler } from './enableCssHandler';
import { renderCodeBlockHandler } from './renderCodeBlockHandler';
import { rightClickHandler } from './rightClickHandler';
import { captureHandler } from './captureHandler';

const ALL_HANDLERS: PlaywrightActionHandler[] = [
  gotoHandler,
  prefillCodepenHandler,
  waitHandler,
  waitForHandler,
  waitForClaudeReadyHandler,
  scrollHandler,
  mouseMoveHandler,
  clickHandler,
  typeHandler,
  focusHandler,
  mouseDragHandler,
  pressHandler,
  highlightHandler,
  openDevtoolsHandler,
  selectDevtoolsNodeHandler,
  toggleDevtoolsNodeHandler,
  disableCssHandler,
  enableCssHandler,
  renderCodeBlockHandler,
  rightClickHandler,
  captureHandler,
];

const HANDLER_BY_CMD = new Map<string, PlaywrightActionHandler>(
  ALL_HANDLERS.map((h) => [h.cmd, h]),
);

if (HANDLER_BY_CMD.size !== ALL_HANDLERS.length) {
  // 핸들러가 같은 cmd 에 두 번 등록되면 dispatch 결과가 모호해진다.
  // module load 시 즉시 fail-fast 한다.
  const cmds = ALL_HANDLERS.map((h) => h.cmd);
  const dupes = cmds.filter((c, i) => cmds.indexOf(c) !== i);
  throw new Error(`PlaywrightActionRegistry: 중복된 cmd 핸들러 등록: ${dupes.join(', ')}`);
}

/** 등록된 cmd 의 핸들러 반환. 없으면 undefined. */
export function getActionHandler(cmd: string): PlaywrightActionHandler | undefined {
  return HANDLER_BY_CMD.get(cmd);
}

/** 등록된 모든 핸들러를 한 번 순회 (lint 룰 metadata 도출용). */
export function getAllActionHandlers(): readonly PlaywrightActionHandler[] {
  return ALL_HANDLERS;
}

/**
 * 등록된 모든 cmd 이름. 핸들러 등록 일관성 검증용.
 * lint 룰의 cmd set SSoT 는 `domain/playwright/PlaywrightCmdMetadata` 를 직접 사용한다.
 */
export function getAllRegisteredCmds(): readonly PlaywrightCmd[] {
  return ALL_HANDLERS.map((h) => h.cmd);
}
