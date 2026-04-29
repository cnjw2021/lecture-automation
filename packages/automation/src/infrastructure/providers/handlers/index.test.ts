import {
  getActionHandler,
  getAllActionHandlers,
  getAllRegisteredCmds,
} from './index';
import {
  getAllPlaywrightCmds,
  getTeachingCmds,
  getForwardSyncPivotForbiddenCmds,
  getVisibleForwardSyncForbiddenCmds,
} from '../../../domain/playwright/PlaywrightCmdMetadata';

describe('PlaywrightActionRegistry', () => {
  it('등록된 모든 cmd 이름이 도메인 SSoT 와 일치한다', () => {
    expect(new Set(getAllRegisteredCmds())).toEqual(new Set(getAllPlaywrightCmds()));
  });

  it('동일 cmd 가 두 번 등록되지 않는다', () => {
    const cmds = getAllRegisteredCmds();
    expect(new Set(cmds).size).toBe(cmds.length);
  });

  it('각 핸들러는 자기 cmd 로 lookup 된다', () => {
    for (const handler of getAllActionHandlers()) {
      expect(getActionHandler(handler.cmd)).toBe(handler);
    }
  });

  it('미등록 cmd lookup 은 undefined 를 반환한다', () => {
    expect(getActionHandler('not_a_cmd')).toBeUndefined();
  });

  it('TEACHING_CMDS SSoT (G-rule 호환)', () => {
    expect(new Set(getTeachingCmds())).toEqual(
      new Set([
        'type',
        'highlight',
        'prefill_codepen',
        'mouse_drag',
        'open_devtools',
        'select_devtools_node',
        'toggle_devtools_node',
        'right_click',
      ]),
    );
  });

  it('FORWARD_SYNC_FORBIDDEN_CMDS SSoT (F-rule pivot 호환)', () => {
    expect(new Set(getForwardSyncPivotForbiddenCmds())).toEqual(
      new Set(['goto', 'wait', 'wait_for', 'wait_for_claude_ready']),
    );
  });

  it('FORWARD_SYNC_VISIBLE_FORBIDDEN_CMDS SSoT (F-rule visible 호환)', () => {
    expect(new Set(getVisibleForwardSyncForbiddenCmds())).toEqual(
      new Set(['wait_for', 'wait_for_claude_ready', 'render_code_block']),
    );
  });

  it('모든 핸들러는 estimateDurationMs 를 정의한다', () => {
    for (const handler of getAllActionHandlers()) {
      expect(typeof handler.estimateDurationMs).toBe('function');
    }
  });

  it('모든 핸들러는 3 가지 실행 모드 메서드를 정의한다', () => {
    for (const handler of getAllActionHandlers()) {
      expect(typeof handler.executeForCapture).toBe('function');
      expect(typeof handler.executeForRecording).toBe('function');
      expect(typeof handler.executeOffscreen).toBe('function');
    }
  });
});
