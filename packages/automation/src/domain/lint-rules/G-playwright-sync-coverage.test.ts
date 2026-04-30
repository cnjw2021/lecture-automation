import { playwrightSyncCoverageRule } from './G-playwright-sync-coverage';

function makeLecture(scene: any) {
  return { lecture_id: 'lec', sequence: [scene] };
}

function makeForwardScene(actions: any[], syncPoints: any[], durationSec = 30): any {
  return {
    scene_id: 1,
    narration: 'narration',
    durationSec,
    visual: { type: 'playwright', action: actions, syncPoints },
  };
}

describe('G-playwright-sync-coverage', () => {
  it('strictOnly: true (STRICT 모드 전용)', () => {
    expect(playwrightSyncCoverageRule.strictOnly).toBe(true);
  });

  it('teaching action 마다 인접 syncPoint 가 있으면 경고 없음', () => {
    const lec = makeLecture(
      makeForwardScene(
        [
          { cmd: 'goto', url: 'https://x.test' },
          { cmd: 'mouse_move', selector: '#a' },
          { cmd: 'type', selector: '#a', key: 'hello' },
        ],
        [{ actionIndex: 2, phrase: 'narration' }],
      ),
    );
    expect(playwrightSyncCoverageRule.run(lec)).toHaveLength(0);
  });

  it('압축 출력: 여러 unanchored teaching action 이 있어도 씬당 1 개 경고', () => {
    const actions = [
      { cmd: 'goto', url: 'https://x.test' },
      { cmd: 'click', selector: '#a' },
      // teaching action 5 개 모두 syncPoint 미연결
      { cmd: 'type', selector: '#a', key: 'a' },
      { cmd: 'wait', ms: 500 },
      { cmd: 'type', selector: '#a', key: 'b' },
      { cmd: 'wait', ms: 500 },
      { cmd: 'type', selector: '#a', key: 'c' },
      { cmd: 'wait', ms: 500 },
      { cmd: 'type', selector: '#a', key: 'd' },
      { cmd: 'wait', ms: 500 },
      { cmd: 'highlight', selector: '#a' },
    ];
    const lec = makeLecture(makeForwardScene(actions, [{ actionIndex: 2, phrase: 'narration' }]));
    const issues = playwrightSyncCoverageRule.run(lec);
    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe('warning');
    expect(issues[0].message).toMatch(/unanchored teaching action \d+ 개/);
  });

  it('under-anchored 도 같은 씬에서는 단일 경고로 통합', () => {
    // syncPoint 1 개 + action 5 개 + fixed 비율 ≥ 30%
    const actions = [
      { cmd: 'goto', url: 'https://x.test' },          // 3000ms
      { cmd: 'mouse_move', selector: '#a' },            // 800ms
      { cmd: 'click', selector: '#a' },                 // 500ms
      { cmd: 'type', selector: '#a', key: 'hello' },    // 5*110 = 550ms
      { cmd: 'highlight', selector: '#a' },             // 1500ms
    ];
    // total fixed = ~6350ms, scene 10s → ratio 63%
    const lec = makeLecture(
      makeForwardScene(actions, [{ actionIndex: 3, phrase: 'narration' }], 10),
    );
    const issues = playwrightSyncCoverageRule.run(lec);
    expect(issues).toHaveLength(1);
    expect(issues[0].message).toContain('under-anchored');
  });

  it('순방향 싱크 대상이 아닌 씬은 검사 생략', () => {
    const lec = makeLecture({
      scene_id: 2,
      narration: 'n',
      visual: { type: 'remotion', component: 'TitleScreen', props: {} },
    });
    expect(playwrightSyncCoverageRule.run(lec)).toHaveLength(0);
  });
});
