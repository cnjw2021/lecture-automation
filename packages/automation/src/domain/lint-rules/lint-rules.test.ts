import { ttsLandminesRule } from './A-tts-landmines';
import { symbolViolationsRule } from './B-symbol-violations';
import { playwrightShapeRule } from './D-playwright-shape';
import { narrationLengthRule } from './E-narration-length';
import { playwrightTimingRule } from './F-playwright-timing';
import { captureePlaceholderRule } from './H-capture-placeholder';
import { allRules } from './index';

function makeLecture(narrations: string[]) {
  return {
    lecture_id: 'test',
    sequence: narrations.map((narration, i) => ({
      scene_id: i + 1,
      narration,
      visual: { type: 'remotion', component: 'TitleScreen', props: {} },
    })),
  };
}

// ---------------------------------------------------------------------------
// A — TTS landmines
// ---------------------------------------------------------------------------

describe('A-tts-landmines', () => {
  it('detects カタカナ + 数字 (パート1〜5)', () => {
    const lec = makeLecture([
      'パート1の最初の講義',
      'パート2 から パート4 まで',
      'これは普通のテキスト',
    ]);
    const issues = ttsLandminesRule.run(lec);
    const ids = issues.map(i => `${i.sceneId}:${i.fixDescription}`);
    expect(ids).toEqual([
      '1:「パート1」→「パートワン」',
      '2:「パート2」→「パートツー」',
      '2:「パート4」→「パートフォー」',
    ]);
  });

  it('detects 上半分 / 下半分', () => {
    const lec = makeLecture([
      '画面の上半分に並んでいます',
      '画面の下半分はプレビュー',
    ]);
    const issues = ttsLandminesRule.run(lec);
    expect(issues).toHaveLength(2);
    expect(issues[0].fixDescription).toBe('「上半分」→「上のエリア」');
    expect(issues[1].fixDescription).toBe('「下半分」→「下のエリア」');
  });

  it('detects standalone gap / px / http://', () => {
    const lec = makeLecture([
      'gap を 10px に設定して http:// で接続',
    ]);
    const issues = ttsLandminesRule.run(lec);
    const fixDescs = issues.map(i => i.fixDescription).sort();
    expect(fixDescs).toEqual([
      '「gap」→「ギャップ」',
      '「http://」→「エイチティーティーピーコロンスラッシュスラッシュ」',
      '「px」→「ピクセル」',
    ]);
  });

  it('does not match gap/px inside larger words', () => {
    const lec = makeLecture([
      'gappy または expx という単語',
    ]);
    const issues = ttsLandminesRule.run(lec);
    expect(issues).toHaveLength(0);
  });

  it('detects Authorize (CodePen↔GitHub 連携ボタン)', () => {
    const lec = makeLecture([
      '「Authorize CodePen」という確認が出てきたら、「Authorize」をクリック',
      'これは関係ないAuthorizedText',
    ]);
    const issues = ttsLandminesRule.run(lec);
    expect(issues).toHaveLength(1);
    expect(issues[0].sceneId).toBe(1);
    expect(issues[0].fixDescription).toBe('「Authorize」→「オーソライズ」');
  });

  it('detects HTML 見出しタグ h1~h6', () => {
    const lec = makeLecture([
      'この「h1」というのは見出しタグです',
      'h2 と h3 は小見出し',
      'h6 が一番小さい',
    ]);
    const fixDescs = ttsLandminesRule.run(lec).map(i => i.fixDescription).sort();
    expect(fixDescs).toEqual([
      '「h1」→「エイチワン」',
      '「h2」→「エイチツー」',
      '「h3」→「エイチスリー」',
      '「h6」→「エイチシックス」',
      "「タグ」→「'たぐ'」",
    ]);
  });

  it('does not match h1 inside larger words (highlight, ph1 등)', () => {
    const lec = makeLecture([
      'highlight を押すと選択されます',
      'ph1losophy のような假想単語',
    ]);
    expect(ttsLandminesRule.run(lec)).toHaveLength(0);
  });

  it("detects standalone 'p' but not inside larger words", () => {
    const lec = makeLecture([
      "2つの'たぐ'のpたぐが入れ子になっている",
      'help や spider のような単語は除外',
    ]);
    const fixDescs = ttsLandminesRule.run(lec).map(i => i.fixDescription).sort();
    expect(fixDescs).toEqual(["「p」→「ぴー」"]);
  });

  it('detects てみ 連接 patterns (てみま / てみて)', () => {
    const lec = makeLecture([
      '見てみましょう、上から順に',
      'プレビューを見てみてください',
    ]);
    const fixDescs = ttsLandminesRule.run(lec).map(i => i.fixDescription).sort();
    expect(fixDescs).toContain('「てみま」→「ま」');
    expect(fixDescs).toContain('「てみて」→「て」');
  });

  it('てみ fix preserves meaning', () => {
    const lec = makeLecture(['見てみましょう、上から順に']);
    const issues = ttsLandminesRule.run(lec);
    issues.find(i => i.fixDescription === '「てみま」→「ま」')!.fix!(lec);
    expect(lec.sequence[0].narration).toBe('見ましょう、上から順に');
  });

  it('fix function applies correctly and removes the issue', () => {
    const lec = makeLecture(['パート1の最初の講義']);
    const issues = ttsLandminesRule.run(lec);
    expect(issues).toHaveLength(1);
    issues[0].fix!(lec);
    expect(lec.sequence[0].narration).toBe('パートワンの最初の講義');
    // 재실행 시 0건
    expect(ttsLandminesRule.run(lec)).toHaveLength(0);
  });

  it('returns empty for clean lecture', () => {
    const lec = makeLecture([
      'これは正常なナレーションです',
      'パートワン から パートツー へ',
    ]);
    expect(ttsLandminesRule.run(lec)).toHaveLength(0);
  });

  it('handles missing narration safely', () => {
    const lec = { sequence: [{ scene_id: 1 }, { scene_id: 2, narration: null }] };
    expect(() => ttsLandminesRule.run(lec)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// B — Symbol violations
// ---------------------------------------------------------------------------

describe('B-symbol-violations', () => {
  it('detects em dash (——)', () => {
    const lec = makeLecture(['これは——重要な部分です']);
    const issues = symbolViolationsRule.run(lec);
    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe('error');
    expect(issues[0].message).toContain('em 대시');
  });

  it('detects parenthetical asides （…）', () => {
    const lec = makeLecture(['これはテスト（補足説明）です']);
    const issues = symbolViolationsRule.run(lec);
    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe('warning');
    expect(issues[0].message).toContain('（…）');
  });

  it('does not flag ASCII parens', () => {
    const lec = makeLecture(['ASCII (paren) は対象外']);
    expect(symbolViolationsRule.run(lec)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// D — Playwright shape
// ---------------------------------------------------------------------------

function makePlaywrightLecture(scenes: any[]) {
  return {
    lecture_id: 'test',
    sequence: scenes.map((s, i) => ({
      scene_id: i + 1,
      narration: s.narration ?? 'テスト',
      ...(typeof s.durationSec === 'number' ? { durationSec: s.durationSec } : {}),
      visual: {
        type: 'playwright',
        action: s.action ?? [],
        ...(s.session ? { session: s.session } : {}),
        ...(s.syncPoints ? { syncPoints: s.syncPoints } : {}),
      },
    })),
  };
}

describe('D-playwright-shape', () => {
  it('detects action without cmd field (legacy {goto: url} format)', () => {
    const lec = makePlaywrightLecture([{ action: [{ goto: 'https://example.com' }] }]);
    const issues = playwrightShapeRule.run(lec);
    expect(issues).toHaveLength(1);
    expect(issues[0].message).toContain('cmd 필드 없음');
    expect(issues[0].message).toContain('goto');
  });

  it('detects unknown cmd value', () => {
    const lec = makePlaywrightLecture([{ action: [{ cmd: 'fly_to_the_moon' }] }]);
    const issues = playwrightShapeRule.run(lec);
    expect(issues).toHaveLength(1);
    expect(issues[0].message).toContain('정의되지 않은 액션');
  });

  it('accepts well-formed actions', () => {
    const lec = makePlaywrightLecture([{
      action: [
        { cmd: 'goto', url: 'https://example.com' },
        { cmd: 'wait', ms: 1000 },
        { cmd: 'click', selector: '.btn' },
      ],
    }]);
    expect(playwrightShapeRule.run(lec)).toHaveLength(0);
  });

  it('detects out-of-range syncPoints actionIndex', () => {
    const lec = makePlaywrightLecture([{
      action: [{ cmd: 'goto', url: 'x' }],
      syncPoints: [{ actionIndex: 5, phrase: 'テスト' }],
    }]);
    const issues = playwrightShapeRule.run(lec);
    expect(issues.some(i => i.message.includes('actionIndex=5'))).toBe(true);
  });

  it('detects syncPoints phrase not in narration', () => {
    const lec = makePlaywrightLecture([{
      narration: '実際のナレーション',
      action: [{ cmd: 'goto', url: 'x' }, { cmd: 'wait', ms: 100 }],
      syncPoints: [{ actionIndex: 1, phrase: '存在しない文字列' }],
    }]);
    const issues = playwrightShapeRule.run(lec);
    expect(issues.some(i => i.message.includes('narration 안에 없음'))).toBe(true);
  });

  it('detects non-unique syncPoints phrase', () => {
    const lec = makePlaywrightLecture([{
      narration: 'テスト テスト テスト',
      action: [{ cmd: 'goto', url: 'x' }, { cmd: 'wait', ms: 100 }],
      syncPoints: [{ actionIndex: 1, phrase: 'テスト' }],
    }]);
    const issues = playwrightShapeRule.run(lec);
    expect(issues.some(i => i.message.includes('3회 등장'))).toBe(true);
  });

  it('skips non-playwright scenes', () => {
    const lec = makeLecture(['普通のナレーション']);
    expect(playwrightShapeRule.run(lec)).toHaveLength(0);
  });

  it('rejects non-integer actionIndex (e.g., 1.5)', () => {
    const lec = makePlaywrightLecture([{
      narration: '入力します。',
      action: [
        { cmd: 'goto', url: 'https://example.com' },
        { cmd: 'wait', ms: 0 },
        { cmd: 'type', selector: '#x', key: 'Hi' },
      ],
      syncPoints: [{ actionIndex: 1.5, phrase: '入力します' }],
    }]);
    const issues = playwrightShapeRule.run(lec);
    expect(issues.some(i =>
      i.severity === 'error' &&
      i.message.includes('actionIndex=1.5') &&
      i.message.includes('정수')
    )).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// E — Narration length
// ---------------------------------------------------------------------------

function makeRemotionScene(opts: { narration: string; durationSec: number; component?: string }) {
  return {
    scene_id: 1,
    narration: opts.narration,
    durationSec: opts.durationSec,
    visual: { type: 'remotion', component: opts.component ?? 'KeyPointScreen', props: {} },
  };
}

describe('E-narration-length', () => {
  it('flags scene with rate > 11 chars/sec', () => {
    // 220자 / 18초 = 12.2자/초 > 11
    const lec = { sequence: [makeRemotionScene({ narration: 'あ'.repeat(220), durationSec: 18 })] };
    const issues = narrationLengthRule.run(lec);
    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe('warning');
    expect(issues[0].message).toContain('TTS 가 잘릴 위험');
  });

  it('passes scene with rate <= 11 chars/sec', () => {
    // 110자 / 11초 = 10자/초
    const lec = { sequence: [makeRemotionScene({ narration: 'あ'.repeat(110), durationSec: 11 })] };
    expect(narrationLengthRule.run(lec)).toHaveLength(0);
  });

  it('does not flag long durationSec (intentional silence)', () => {
    // 11자 / 5초 = 2.2자/초 (긴 여백)
    const lec = { sequence: [makeRemotionScene({ narration: 'あ'.repeat(11), durationSec: 5 })] };
    expect(narrationLengthRule.run(lec)).toHaveLength(0);
  });

  it('skips MyCodeScene and CodeWalkthroughScreen', () => {
    const lec = {
      sequence: [
        makeRemotionScene({ narration: 'あ'.repeat(220), durationSec: 5, component: 'MyCodeScene' }),
        makeRemotionScene({ narration: 'あ'.repeat(220), durationSec: 5, component: 'CodeWalkthroughScreen' }),
      ],
    };
    expect(narrationLengthRule.run(lec)).toHaveLength(0);
  });

  it('skips playwright and screenshot scenes', () => {
    const lec = {
      sequence: [
        { scene_id: 1, narration: 'あ'.repeat(500), durationSec: 5, visual: { type: 'playwright', action: [] } },
        { scene_id: 2, narration: 'あ'.repeat(500), durationSec: 5, visual: { type: 'screenshot', url: 'x' } },
      ],
    };
    expect(narrationLengthRule.run(lec)).toHaveLength(0);
  });

  it('handles missing durationSec safely', () => {
    const lec = { sequence: [{ scene_id: 1, narration: 'テスト', visual: { type: 'remotion', component: 'KeyPointScreen', props: {} } }] };
    expect(() => narrationLengthRule.run(lec)).not.toThrow();
    expect(narrationLengthRule.run(lec)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// F — Playwright timing
// ---------------------------------------------------------------------------

describe('F-playwright-timing', () => {
  it('detects first syncPoint before setup floor', () => {
    const lec = makePlaywrightLecture([{
      narration: 'すぐ入力します。準備ができたら説明します。',
      durationSec: 10,
      action: [
        { cmd: 'goto', url: 'https://codepen.io/pen/' },
        { cmd: 'mouse_move', to: [100, 100] },
        { cmd: 'click', selector: '#box-html .CodeMirror' },
        { cmd: 'wait', ms: 0 },
        { cmd: 'type', selector: '#box-html .CodeMirror', key: 'Hello' },
      ],
      syncPoints: [{ actionIndex: 4, phrase: 'すぐ入力します' }],
    }]);
    const issues = playwrightTimingRule.run(lec);
    expect(issues.some(i => i.severity === 'error' && i.message.includes('setup floor'))).toBe(true);
  });

  it('detects segment fixed action budget over narration budget', () => {
    const lec = makePlaywrightLecture([{
      narration: '短く話してから入力します。',
      durationSec: 2,
      action: [
        { cmd: 'type', selector: '#box-html .CodeMirror', key: 'x'.repeat(50) },
        { cmd: 'wait', ms: 0 },
        { cmd: 'mouse_move', to: [100, 100] },
      ],
      syncPoints: [{ actionIndex: 2, phrase: '入力します' }],
    }]);
    const issues = playwrightTimingRule.run(lec);
    expect(issues.some(i => i.severity === 'error' && i.message.includes('fixed action'))).toBe(true);
  });

  it('rejects wait_for_claude_ready as a forward syncPoint target', () => {
    const lec = makePlaywrightLecture([{
      narration: '準備してから結果を確認します。',
      durationSec: 10,
      session: { mode: 'shared', id: 'claude-demo' },
      action: [
        { cmd: 'wait', ms: 0 },
        { cmd: 'wait_for_claude_ready', timeout: 180000 },
        { cmd: 'wait', ms: 0 },
      ],
      syncPoints: [{ actionIndex: 1, phrase: '結果を確認します' }],
    }]);
    const issues = playwrightTimingRule.run(lec);
    expect(issues.some(i => i.severity === 'error' && i.message.includes('wait_for_claude_ready'))).toBe(true);
  });

  it('passes a budgeted playwright segment with slack and wait', () => {
    const lec = makePlaywrightLecture([{
      narration: '入力します。結果を確認します。',
      durationSec: 8,
      action: [
        { cmd: 'wait', ms: 0 },
        { cmd: 'type', selector: '#box-html .CodeMirror', key: 'Hello' },
        { cmd: 'wait', ms: 0 },
      ],
      syncPoints: [{ actionIndex: 1, phrase: '入力します' }],
    }]);
    expect(playwrightTimingRule.run(lec)).toHaveLength(0);
  });

  it('rejects visible wait_for_claude_ready in shared session forward sync', () => {
    const lec = makePlaywrightLecture([{
      narration: '結果を確認します。続けて入力します。',
      durationSec: 10,
      session: { mode: 'shared', id: 'claude-demo' },
      action: [
        { cmd: 'wait_for_claude_ready', timeout: 180000 },
        { cmd: 'wait', ms: 0 },
        { cmd: 'type', selector: 'div.ProseMirror', key: 'next' },
      ],
      syncPoints: [{ actionIndex: 2, phrase: '続けて入力します' }],
    }]);
    const issues = playwrightTimingRule.run(lec);
    expect(issues.some(i =>
      i.severity === 'error' &&
      i.message.includes('wait_for_claude_ready') &&
      i.message.includes('visible')
    )).toBe(true);
  });

  it('accepts offscreen wait_for_claude_ready in shared session forward sync', () => {
    const lec = makePlaywrightLecture([{
      narration: '結果を確認します。続けて入力します。',
      durationSec: 10,
      session: { mode: 'shared', id: 'claude-demo' },
      action: [
        { cmd: 'wait_for_claude_ready', timeout: 180000, offscreen: true },
        { cmd: 'wait', ms: 0 },
        { cmd: 'type', selector: 'div.ProseMirror', key: 'next' },
      ],
      syncPoints: [{ actionIndex: 2, phrase: '続けて入力します' }],
    }]);
    const issues = playwrightTimingRule.run(lec);
    expect(issues.some(i =>
      i.severity === 'error' && i.message.includes('wait_for_claude_ready')
    )).toBe(false);
  });

  it('rejects syncPoint pointing to offscreen action', () => {
    const lec = makePlaywrightLecture([{
      narration: '入力します。結果を確認します。',
      durationSec: 10,
      session: { mode: 'shared', id: 'claude-demo' },
      action: [
        { cmd: 'wait', ms: 0 },
        { cmd: 'wait_for_claude_ready', timeout: 180000, offscreen: true },
        { cmd: 'wait', ms: 0 },
        { cmd: 'type', selector: 'div.ProseMirror', key: 'next' },
      ],
      syncPoints: [{ actionIndex: 1, phrase: '結果を確認します' }],
    }]);
    const issues = playwrightTimingRule.run(lec);
    expect(issues.some(i =>
      i.severity === 'error' &&
      i.message.includes('offscreen') &&
      i.message.includes('세그먼트 피벗')
    )).toBe(true);
  });

  it('skips non-integer actionIndex defensively (D-rule reports the error)', () => {
    const lec = makePlaywrightLecture([{
      narration: '入力します。',
      durationSec: 10,
      action: [
        { cmd: 'wait', ms: 0 },
        { cmd: 'type', selector: '#x', key: 'Hi' },
      ],
      syncPoints: [{ actionIndex: 1.5, phrase: '入力します' }],
    }]);
    // F-rule defensively skips (no segment validation), so it must not crash
    // and must not produce false positives based on a non-integer index.
    const issues = playwrightTimingRule.run(lec);
    expect(issues).toHaveLength(0);
  });

  it('rejects syncPoints whose phrase order is reversed against actionIndex order', () => {
    // sortedSyncPoints 는 actionIndex 순으로 [1, 3] 이지만 phrase 위치는 narration 에서 [50자, 0자]
    // = phrase 가 역순. silent skip 으로 누락되는 것을 막아야 함.
    const lec = makePlaywrightLecture([{
      narration: '後半に出る言葉。前半に出る言葉。最後の言葉。',  // "前半..." 가 더 늦은 actionIndex
      durationSec: 12,
      action: [
        { cmd: 'wait', ms: 0 },
        { cmd: 'type', selector: '#x', key: 'A' },
        { cmd: 'wait', ms: 0 },
        { cmd: 'type', selector: '#x', key: 'B' },
        { cmd: 'wait', ms: 0 },
      ],
      syncPoints: [
        { actionIndex: 1, phrase: '後半に出る言葉' },     // pos 0
        { actionIndex: 3, phrase: '前半に出る言葉' },     // pos 8
      ],
    }]);
    // 위 케이스는 실제로는 정순 (phrase 텍스트만 보면). 역순 테스트로 다시 작성:
    const reverseLec = makePlaywrightLecture([{
      narration: '前半の言葉。後半の言葉。',  // 前半=pos0, 後半=pos5
      durationSec: 10,
      action: [
        { cmd: 'wait', ms: 0 },
        { cmd: 'type', selector: '#x', key: 'A' },
        { cmd: 'wait', ms: 0 },
        { cmd: 'type', selector: '#x', key: 'B' },
        { cmd: 'wait', ms: 0 },
      ],
      syncPoints: [
        { actionIndex: 1, phrase: '後半の言葉' },  // 더 뒤에 있는 phrase 가 더 작은 actionIndex
        { actionIndex: 3, phrase: '前半の言葉' },  // 더 앞에 있는 phrase 가 더 큰 actionIndex
      ],
    }]);
    const issues = playwrightTimingRule.run(reverseLec);
    expect(issues.some(i =>
      i.severity === 'error' &&
      i.message.includes('순서가 일치하지 않음')
    )).toBe(true);
    // unused lec to avoid lint complaint
    void lec;
  });

  it('handles syncPoints[0].actionIndex=0 with proper segment-target mapping', () => {
    // actionIndex=0 syncPoint 일 때 buildSegments 가 빈 pre-segment 를 포함해도
    // segments[i] ↔ targetFirings 매핑이 일관됨을 검증. 매핑이 어긋나면 false positive 발생.
    // 정상 케이스: 첫 phrase 는 narration 시작에, action[0]=mouse_move(teaching) 부터 시작.
    const lec = makePlaywrightLecture([{
      narration: '今ここをクリックします。次に確認します。',
      durationSec: 10,
      action: [
        { cmd: 'mouse_move', to: [400, 250] },                  // teaching, syncPoint 0
        { cmd: 'wait', ms: 0 },
        { cmd: 'type', selector: '#box-html .CodeMirror', key: 'X' },
        { cmd: 'wait', ms: 0 },
      ],
      syncPoints: [
        { actionIndex: 0, phrase: '今ここをクリックします' },
        { actionIndex: 2, phrase: '次に確認します' },
      ],
    }]);
    const issues = playwrightTimingRule.run(lec);
    // 매핑이 어긋났을 때 발생하던 false positive(전체 액션이 잘못된 budget 비교) 가 없어야 함.
    const segmentBudgetErrors = issues.filter(i =>
      i.severity === 'error' && i.message.includes('fixed action') && i.message.includes('narration budget')
    );
    expect(segmentBudgetErrors).toHaveLength(0);
  });

  it('rejects duplicate actionIndex in syncPoints', () => {
    const lec = makePlaywrightLecture([{
      narration: '入力します。次に確認します。',
      durationSec: 10,
      action: [
        { cmd: 'wait', ms: 0 },
        { cmd: 'type', selector: '#box-html .CodeMirror', key: 'Hello' },
        { cmd: 'wait', ms: 0 },
      ],
      syncPoints: [
        { actionIndex: 1, phrase: '入力します' },
        { actionIndex: 1, phrase: '次に確認します' },
      ],
    }]);
    const issues = playwrightTimingRule.run(lec);
    expect(issues.some(i =>
      i.severity === 'error' &&
      i.message.includes('중복') &&
      i.message.includes('actionIndex=1')
    )).toBe(true);
  });

  it('rejects visible render_code_block in forward sync scene', () => {
    const lec = makePlaywrightLecture([{
      narration: '入力します。コードを取り込みます。',
      durationSec: 10,
      session: { mode: 'shared', id: 'claude-demo' },
      action: [
        { cmd: 'wait', ms: 0 },
        { cmd: 'type', selector: 'div.ProseMirror', key: 'hi' },
        { cmd: 'wait', ms: 0 },
        { cmd: 'render_code_block' },
      ],
      syncPoints: [{ actionIndex: 1, phrase: '入力します' }],
    }]);
    const issues = playwrightTimingRule.run(lec);
    expect(issues.some(i =>
      i.severity === 'error' && i.message.includes('render_code_block')
    )).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// H — capture placeholder
// ---------------------------------------------------------------------------

describe('H-capture-placeholder', () => {
  function makePlaywrightLecture(scenes: any[]) {
    return {
      lecture_id: 'test-h',
      sequence: scenes.map((s, i) => ({
        scene_id: i + 1,
        narration: s.narration ?? 'narration',
        visual: s.visual ?? { type: 'remotion', component: 'TitleScreen', props: {} },
      })),
    };
  }

  it('passes when ${capture:key} 가 더 앞 씬의 capture 로 정의되어 있다', () => {
    const lec = makePlaywrightLecture([
      {
        narration: 'まずキャプチャ',
        visual: {
          type: 'playwright',
          action: [
            { cmd: 'goto', url: 'https://example.com' },
            { cmd: 'capture', selector: 'meta[property="og:image"]', attribute: 'content', saveAs: 'photo_id' },
          ],
        },
      },
      {
        narration: 'プレースホルダー使用',
        visual: {
          type: 'playwright',
          action: [
            { cmd: 'goto', url: 'https://codepen.io' },
            { cmd: 'click', selector: '#box-html .CodeMirror' },
            { cmd: 'type', selector: '#box-html .CodeMirror textarea', key: 'src="${capture:photo_id}"' },
          ],
        },
      },
    ]);
    const issues = captureePlaceholderRule.run(lec);
    expect(issues).toEqual([]);
  });

  it('detects undefined ${capture:key}', () => {
    const lec = makePlaywrightLecture([
      {
        narration: 'プレースホルダー',
        visual: {
          type: 'playwright',
          action: [
            { cmd: 'type', selector: 'input', key: '${capture:nonexistent}' },
          ],
        },
      },
    ]);
    const issues = captureePlaceholderRule.run(lec);
    expect(issues).toHaveLength(1);
    expect(issues[0].message).toContain('nonexistent');
  });

  it('detects placeholder used before saveAs (later scene)', () => {
    const lec = makePlaywrightLecture([
      {
        narration: '前の씬',
        visual: {
          type: 'playwright',
          action: [
            { cmd: 'type', selector: 'input', key: '${capture:photo_id}' },
          ],
        },
      },
      {
        narration: '後の씬에서 saveAs',
        visual: {
          type: 'playwright',
          action: [
            { cmd: 'capture', selector: 'meta', attribute: 'content', saveAs: 'photo_id' },
          ],
        },
      },
    ]);
    const issues = captureePlaceholderRule.run(lec);
    expect(issues.length).toBeGreaterThan(0);
    expect(issues[0].message).toContain('saveAs 정의가 뒤에');
  });

  it('detects placeholder in non-expandable field', () => {
    const lec = makePlaywrightLecture([
      {
        narration: 'バツノート',
        visual: {
          type: 'playwright',
          action: [
            { cmd: 'capture', selector: 'meta', attribute: 'content', saveAs: 'foo' },
          ],
        },
      },
      {
        narration: 'プレースホルダー',
        visual: {
          type: 'playwright',
          action: [
            { cmd: 'type', selector: 'input', key: 'ok', note: 'use ${capture:foo}' },
          ],
        },
      },
    ]);
    const issues = captureePlaceholderRule.run(lec);
    expect(issues.length).toBeGreaterThan(0);
    expect(issues[0].message).toContain('placeholder 치환 대상 필드가 아닙니다');
  });

  it('right_click.captureFromTarget 의 saveAs 도 정의로 인정한다', () => {
    const lec = makePlaywrightLecture([
      {
        narration: 'right_click 으로 saveAs',
        visual: {
          type: 'playwright',
          action: [
            { cmd: 'goto', url: 'https://unsplash.com' },
            {
              cmd: 'right_click',
              selector: 'img',
              captureFromTarget: { attribute: 'src', saveAs: 'photo_url' },
            },
          ],
        },
      },
      {
        narration: '使う',
        visual: {
          type: 'playwright',
          action: [
            { cmd: 'type', selector: 'input', key: '${capture:photo_url}' },
          ],
        },
      },
    ]);
    const issues = captureePlaceholderRule.run(lec);
    expect(issues).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Regression: lecture-01-04 (round 1 state) should detect all known issues
// ---------------------------------------------------------------------------

describe('Regression: lecture-01-04 round-1 fixture', () => {
  // 01-04 round-1 状態에 들어 있던 실제 문제들의 미니 fixture.
  // 이 fixture 는 향후 main 으로 머지된 lecture-01-04.json 가 다시 깨지는 것을
  // 방지하기 위한 시드. 실제 9건과 동일한 패턴.
  const ROUND1_NARRATIONS = [
    'パート1の最初の講義で「パート1の旅」を始めます。',           // パート1 x2
    '画面の上半分に3つの領域',                                       // 上半分
    'パート2以降の講義で使っていきます',                              // パート2
    'そして画面の下半分。ここがプレビューエリアです',                // 下半分
    'パート2 から パート4 まで',                                      // パート2, パート4
    'パート2 でルールを学びます',                                     // パート2
    'パート3 で CSS を学ぶと',                                        // パート3
    'パート2 に入ります',                                             // パート2
  ];

  it('catches all 9 landmine occurrences from the original 01-04 round-1 state', () => {
    const lec = makeLecture(ROUND1_NARRATIONS);
    const issues = ttsLandminesRule.run(lec);
    expect(issues).toHaveLength(9);
    expect(issues.every(i => !!i.fix)).toBe(true);
  });

  it('all issues are auto-fixable and lecture becomes clean after fix', () => {
    const lec = makeLecture(ROUND1_NARRATIONS);
    for (const issue of ttsLandminesRule.run(lec)) {
      issue.fix!(lec);
    }
    const remaining = allRules.flatMap(r => r.run(lec));
    expect(remaining).toHaveLength(0);
  });
});
