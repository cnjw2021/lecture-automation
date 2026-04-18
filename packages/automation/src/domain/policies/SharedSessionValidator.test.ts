import { validateSharedSessions } from './SharedSessionValidator';
import { Lecture, Scene } from '../entities/Lecture';

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

function makeSharedScene(
  id: number,
  actions: any[],
  sessionId = 'test-session',
): Scene {
  return {
    scene_id: id,
    narration: 'テスト',
    visual: {
      type: 'playwright',
      action: actions,
      storageState: 'config/auth/claude.json',
      session: { id: sessionId, mode: 'shared' },
    },
  };
}

function makeLecture(...scenes: Scene[]): Lecture {
  return {
    lecture_id: 'test',
    metadata: { title: 'Test', target_duration: '10', target_audience: 'test' },
    sequence: scenes,
  };
}

const gotoAction = { cmd: 'goto', url: 'https://claude.ai/new' } as const;
const waitAction = { cmd: 'wait', ms: 1000 } as const;
const pressAction = { cmd: 'press', key: 'Enter' } as const;
const scrollAction = { cmd: 'scroll', deltaY: 300 } as const;

// ---------------------------------------------------------------------------
// R1: urlFromScene 금지
// ---------------------------------------------------------------------------

describe('R1: urlFromScene 금지', () => {
  it('urlFromScene 없으면 위반 없음', () => {
    const lecture = makeLecture(
      makeSharedScene(1, [gotoAction, waitAction]),
    );
    expect(validateSharedSessions(lecture)).toHaveLength(0);
  });

  it('urlFromScene 사용 시 위반 보고', () => {
    const lecture = makeLecture(
      makeSharedScene(1, [
        gotoAction,
        { cmd: 'goto', urlFromScene: 5 },
      ]),
    );
    const violations = validateSharedSessions(lecture);
    expect(violations).toHaveLength(1);
    expect(violations[0].rule).toBe('shared-session-no-url-from-scene');
    expect(violations[0].sceneId).toBe(1);
    expect(violations[0].actionIndex).toBe(1);
  });

  it('여러 씬에 urlFromScene 있으면 각각 위반 보고', () => {
    const lecture = makeLecture(
      makeSharedScene(1, [{ cmd: 'goto', urlFromScene: 3 }]),
      makeSharedScene(2, [{ cmd: 'goto', urlFromScene: 4 }]),
    );
    const violations = validateSharedSessions(lecture);
    expect(violations.filter(v => v.rule === 'shared-session-no-url-from-scene')).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// R2: 결과 확인 씬의 goto 전면 금지 (offscreen 포함)
// ---------------------------------------------------------------------------

describe('R2: continuation 씬 goto 금지', () => {
  it('entry 씬 goto 는 허용', () => {
    const lecture = makeLecture(
      makeSharedScene(1, [gotoAction, pressAction]),
      makeSharedScene(2, [scrollAction, waitAction]),
    );
    expect(validateSharedSessions(lecture)).toHaveLength(0);
  });

  it('continuation 씬 visible goto 는 위반', () => {
    const lecture = makeLecture(
      makeSharedScene(1, [gotoAction]),
      makeSharedScene(2, [gotoAction, scrollAction]),
    );
    const violations = validateSharedSessions(lecture);
    expect(violations.filter(v => v.rule === 'shared-session-no-goto-on-continuation')).toHaveLength(1);
    expect(violations[0].sceneId).toBe(2);
    expect(violations[0].actionIndex).toBe(0);
  });

  it('continuation 씬 offscreen goto 도 위반', () => {
    const offscreenGoto = { cmd: 'goto', url: 'https://x.com', offscreen: true } as const;
    const lecture = makeLecture(
      makeSharedScene(1, [gotoAction]),
      makeSharedScene(2, [offscreenGoto, scrollAction]),
    );
    const violations = validateSharedSessions(lecture);
    expect(violations.filter(v => v.rule === 'shared-session-no-goto-on-continuation')).toHaveLength(1);
    expect(violations[0].sceneId).toBe(2);
  });

  it('continuation 씬에 goto 복수 → 각각 위반', () => {
    const lecture = makeLecture(
      makeSharedScene(1, [gotoAction]),
      makeSharedScene(2, [gotoAction, waitAction, gotoAction]),
    );
    const violations = validateSharedSessions(lecture)
      .filter(v => v.rule === 'shared-session-no-goto-on-continuation');
    expect(violations).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// R3: render_code_block 금지
// ---------------------------------------------------------------------------

describe('R3: render_code_block 금지', () => {
  it('render_code_block 없으면 위반 없음', () => {
    const lecture = makeLecture(
      makeSharedScene(1, [gotoAction, scrollAction]),
    );
    expect(validateSharedSessions(lecture)).toHaveLength(0);
  });

  it('entry 씬의 render_code_block 도 위반', () => {
    const rcb = { cmd: 'render_code_block' } as const;
    const lecture = makeLecture(
      makeSharedScene(1, [gotoAction, rcb]),
    );
    const violations = validateSharedSessions(lecture);
    expect(violations.filter(v => v.rule === 'shared-session-no-render-code-block')).toHaveLength(1);
    expect(violations[0].sceneId).toBe(1);
    expect(violations[0].actionIndex).toBe(1);
  });

  it('continuation 씬의 render_code_block 도 위반', () => {
    const rcb = { cmd: 'render_code_block' } as const;
    const lecture = makeLecture(
      makeSharedScene(1, [gotoAction]),
      makeSharedScene(2, [scrollAction, rcb]),
    );
    const violations = validateSharedSessions(lecture);
    expect(violations.filter(v => v.rule === 'shared-session-no-render-code-block')).toHaveLength(1);
    expect(violations[0].sceneId).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// 복합: 여러 규칙 동시 위반
// ---------------------------------------------------------------------------

describe('복합 위반', () => {
  it('R1+R2+R3 모두 동시에 검출', () => {
    const rcb = { cmd: 'render_code_block' } as const;
    const lecture = makeLecture(
      makeSharedScene(1, [{ cmd: 'goto', urlFromScene: 5 }]),
      makeSharedScene(2, [gotoAction, rcb]),
    );
    const violations = validateSharedSessions(lecture);
    const rules = violations.map(v => v.rule);
    expect(rules).toContain('shared-session-no-url-from-scene');
    expect(rules).toContain('shared-session-no-goto-on-continuation');
    expect(rules).toContain('shared-session-no-render-code-block');
  });
});

// ---------------------------------------------------------------------------
// isolated 씬은 검증 대상 아님
// ---------------------------------------------------------------------------

describe('isolated 씬 무시', () => {
  it('shared session 없으면 위반 없음', () => {
    const isolatedScene: Scene = {
      scene_id: 1,
      narration: 'テスト',
      visual: {
        type: 'playwright',
        action: [gotoAction, { cmd: 'goto', urlFromScene: 3 }],
      },
    };
    const lecture = makeLecture(isolatedScene);
    expect(validateSharedSessions(lecture)).toHaveLength(0);
  });
});
