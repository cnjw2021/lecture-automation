import { PlaywrightCmd } from '../entities/Lecture';
import { ActionLintMetadata } from './PlaywrightActionHandler';

/**
 * PlaywrightCmd 별 lint 메타데이터 SSoT (#144 Phase 0e).
 *
 * 도메인 레이어에 두는 이유:
 *   - lint 룰(D/F/G) 은 도메인 안에 있다. 인프라(`infrastructure/providers/handlers`) 를
 *     import 할 수 없다 → 메타는 도메인 안에 있어야 한다.
 *   - 핸들러 본체는 Playwright Page 등 인프라 의존이 있어 인프라 레이어에 머문다.
 *   - 두 곳을 잇는 SSoT 가 본 파일이다. 핸들러는 본 파일을 읽어 자기 metadata 를 채우고,
 *     lint 룰은 본 파일에서 cmd set 을 도출한다.
 *
 * 새 cmd 추가 시:
 *   1) PlaywrightCmd 유니온에 추가
 *   2) 본 파일의 META 에 한 줄 추가
 *   3) handlers/{newCmd}Handler.ts 작성 (메타는 getCmdLintMetadata 에서 받는다)
 *   4) D/F/G lint 룰은 자동으로 새 cmd 를 인식 — 추가 작업 없음.
 */

interface CmdMetaEntry extends ActionLintMetadata {}

const META: Readonly<Record<PlaywrightCmd, CmdMetaEntry>> = {
  goto: {
    isTeaching: false,
    isForwardSyncPivotForbidden: true,
    isVisibleForwardSyncForbidden: false,
  },
  wait: {
    isTeaching: false,
    isForwardSyncPivotForbidden: true,
    isVisibleForwardSyncForbidden: false,
  },
  wait_for: {
    isTeaching: false,
    isForwardSyncPivotForbidden: true,
    isVisibleForwardSyncForbidden: true,
  },
  wait_for_claude_ready: {
    isTeaching: false,
    isForwardSyncPivotForbidden: true,
    isVisibleForwardSyncForbidden: true,
  },
  scroll: {
    isTeaching: false,
    isForwardSyncPivotForbidden: false,
    isVisibleForwardSyncForbidden: false,
  },
  mouse_move: {
    isTeaching: false,
    isForwardSyncPivotForbidden: false,
    isVisibleForwardSyncForbidden: false,
  },
  click: {
    isTeaching: false,
    isForwardSyncPivotForbidden: false,
    isVisibleForwardSyncForbidden: false,
  },
  type: {
    isTeaching: true,
    isForwardSyncPivotForbidden: false,
    isVisibleForwardSyncForbidden: false,
  },
  press: {
    isTeaching: false,
    isForwardSyncPivotForbidden: false,
    isVisibleForwardSyncForbidden: false,
  },
  focus: {
    isTeaching: false,
    isForwardSyncPivotForbidden: false,
    isVisibleForwardSyncForbidden: false,
  },
  mouse_drag: {
    isTeaching: true,
    isForwardSyncPivotForbidden: false,
    isVisibleForwardSyncForbidden: false,
  },
  highlight: {
    isTeaching: true,
    isForwardSyncPivotForbidden: false,
    isVisibleForwardSyncForbidden: false,
  },
  open_devtools: {
    isTeaching: true,
    isForwardSyncPivotForbidden: false,
    isVisibleForwardSyncForbidden: false,
  },
  select_devtools_node: {
    isTeaching: true,
    isForwardSyncPivotForbidden: false,
    isVisibleForwardSyncForbidden: false,
  },
  toggle_devtools_node: {
    isTeaching: true,
    isForwardSyncPivotForbidden: false,
    isVisibleForwardSyncForbidden: false,
  },
  disable_css: {
    isTeaching: false,
    isForwardSyncPivotForbidden: false,
    isVisibleForwardSyncForbidden: false,
  },
  enable_css: {
    isTeaching: false,
    isForwardSyncPivotForbidden: false,
    isVisibleForwardSyncForbidden: false,
  },
  render_code_block: {
    isTeaching: false,
    isForwardSyncPivotForbidden: false,
    isVisibleForwardSyncForbidden: true,
  },
  prefill_codepen: {
    isTeaching: true,
    isForwardSyncPivotForbidden: false,
    isVisibleForwardSyncForbidden: false,
  },
  right_click: {
    isTeaching: true,
    isForwardSyncPivotForbidden: false,
    isVisibleForwardSyncForbidden: false,
  },
  capture: {
    isTeaching: false,
    isForwardSyncPivotForbidden: false,
    isVisibleForwardSyncForbidden: false,
  },
};

/** 모든 등록된 PlaywrightCmd 이름. D-rule VALID_CMDS 의 SSoT. */
export function getAllPlaywrightCmds(): readonly PlaywrightCmd[] {
  return Object.keys(META) as PlaywrightCmd[];
}

/** 특정 cmd 의 메타데이터. 미정의 cmd 는 undefined. */
export function getCmdLintMetadata(cmd: string): ActionLintMetadata | undefined {
  return META[cmd as PlaywrightCmd];
}

/** G-rule TEACHING_CMDS SSoT. */
export function getTeachingCmds(): readonly PlaywrightCmd[] {
  return (Object.keys(META) as PlaywrightCmd[]).filter((c) => META[c].isTeaching);
}

/** F-rule pivot forbidden SSoT. */
export function getForwardSyncPivotForbiddenCmds(): readonly PlaywrightCmd[] {
  return (Object.keys(META) as PlaywrightCmd[]).filter((c) => META[c].isForwardSyncPivotForbidden);
}

/** F-rule visible forbidden SSoT. */
export function getVisibleForwardSyncForbiddenCmds(): readonly PlaywrightCmd[] {
  return (Object.keys(META) as PlaywrightCmd[]).filter((c) => META[c].isVisibleForwardSyncForbidden);
}
