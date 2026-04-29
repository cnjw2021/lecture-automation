import {
  getAllPlaywrightCmds,
  getCmdLintMetadata,
  getTeachingCmds,
  getForwardSyncPivotForbiddenCmds,
  getVisibleForwardSyncForbiddenCmds,
} from './PlaywrightCmdMetadata';

describe('PlaywrightCmdMetadata', () => {
  it('전체 21 개 cmd 가 등록되어 있다', () => {
    expect(new Set(getAllPlaywrightCmds())).toEqual(
      new Set([
        'goto',
        'wait',
        'wait_for',
        'wait_for_claude_ready',
        'scroll',
        'mouse_move',
        'click',
        'type',
        'focus',
        'mouse_drag',
        'press',
        'highlight',
        'open_devtools',
        'select_devtools_node',
        'toggle_devtools_node',
        'disable_css',
        'enable_css',
        'render_code_block',
        'right_click',
        'capture',
        'prefill_codepen',
      ]),
    );
  });

  it('TEACHING_CMDS (G-rule 호환)', () => {
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

  it('FORWARD_SYNC_FORBIDDEN_CMDS (F-rule pivot 호환)', () => {
    expect(new Set(getForwardSyncPivotForbiddenCmds())).toEqual(
      new Set(['goto', 'wait', 'wait_for', 'wait_for_claude_ready']),
    );
  });

  it('FORWARD_SYNC_VISIBLE_FORBIDDEN_CMDS (F-rule visible 호환)', () => {
    expect(new Set(getVisibleForwardSyncForbiddenCmds())).toEqual(
      new Set(['wait_for', 'wait_for_claude_ready', 'render_code_block']),
    );
  });

  it('미등록 cmd lookup 은 undefined', () => {
    expect(getCmdLintMetadata('not_a_cmd')).toBeUndefined();
  });

  it('등록된 모든 cmd 의 metadata 가 정의되어 있다', () => {
    for (const cmd of getAllPlaywrightCmds()) {
      const meta = getCmdLintMetadata(cmd);
      expect(meta).toBeDefined();
      expect(typeof meta!.isTeaching).toBe('boolean');
      expect(typeof meta!.isForwardSyncPivotForbidden).toBe('boolean');
      expect(typeof meta!.isVisibleForwardSyncForbidden).toBe('boolean');
    }
  });
});
