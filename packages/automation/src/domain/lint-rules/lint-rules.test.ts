import { ttsLandminesRule } from './A-tts-landmines';
import { symbolViolationsRule } from './B-symbol-violations';
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
