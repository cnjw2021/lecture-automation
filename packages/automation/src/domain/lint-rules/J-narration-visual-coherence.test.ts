import { narrationVisualCoherenceRule } from './J-narration-visual-coherence';

function makeLecture(scene: any) {
  return { lecture_id: 'lec', sequence: [scene] };
}

function abstractScene(component: string, narration: string) {
  return {
    scene_id: 1,
    narration,
    visual: { type: 'remotion', component, props: {} },
  };
}

describe('J-narration-visual-coherence', () => {
  it('lecture-02-03 씬 30 패턴 검출 (NumberedListScreen + 「サイトが表示されました」)', () => {
    const lec = makeLecture(
      abstractScene(
        'NumberedListScreen',
        'サイトが表示されましたね。英語のサイトですが、画面の上の方に検索バーがありますので、ここに好きなキーワードを入れましょう。',
      ),
    );
    const issues = narrationVisualCoherenceRule.run(lec);
    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe('warning');
    expect(issues[0].sceneId).toBe(1);
    expect(issues[0].message).toContain('NumberedListScreen');
    expect(issues[0].message).toContain('表示されました');
    expect(issues[0].message).toContain('画面の上の方');
    expect(issues[0].message).toContain('検索バー');
  });

  it('실제 화면을 보여주는 visual (Playwright) 은 검사 생략', () => {
    const lec = makeLecture({
      scene_id: 2,
      narration: 'サイトが表示されましたね。',
      visual: { type: 'playwright', action: [{ cmd: 'goto', url: 'https://example.com' }] },
    });
    expect(narrationVisualCoherenceRule.run(lec)).toHaveLength(0);
  });

  it('BrowserMockScreen 도 화면 자료를 보여주므로 검사 제외', () => {
    const lec = makeLecture({
      scene_id: 3,
      narration: '画面の上の方にアドレスバーがあります。',
      visual: { type: 'remotion', component: 'BrowserMockScreen', props: { url: 'https://x' } },
    });
    expect(narrationVisualCoherenceRule.run(lec)).toHaveLength(0);
  });

  it('ImageScreen 은 검사 제외', () => {
    const lec = makeLecture({
      scene_id: 4,
      narration: 'こちらをご覧ください',
      visual: { type: 'remotion', component: 'ImageScreen', props: { src: '/x.png' } },
    });
    expect(narrationVisualCoherenceRule.run(lec)).toHaveLength(0);
  });

  it('추상 슬라이드여도 시각 의존 표현이 없으면 검사 통과', () => {
    const lec = makeLecture(
      abstractScene('NumberedListScreen', 'これから3つのステップで進めていきます。'),
    );
    expect(narrationVisualCoherenceRule.run(lec)).toHaveLength(0);
  });

  it('TitleScreen + 「画面の右側」 검출', () => {
    const lec = makeLecture(
      abstractScene('TitleScreen', '画面の右側を見ながら進めていきましょう。'),
    );
    const issues = narrationVisualCoherenceRule.run(lec);
    expect(issues).toHaveLength(1);
    expect(issues[0].message).toContain('画面の右');
  });

  it('SummaryScreen + 「右クリックすると」 검출', () => {
    const lec = makeLecture(
      abstractScene('SummaryScreen', '右クリックするとメニューが開きます。'),
    );
    const issues = narrationVisualCoherenceRule.run(lec);
    expect(issues).toHaveLength(1);
    expect(issues[0].message).toContain('右クリックすると');
  });

  it('narration 이 비어 있으면 검사 생략', () => {
    const lec = makeLecture(abstractScene('NumberedListScreen', ''));
    expect(narrationVisualCoherenceRule.run(lec)).toHaveLength(0);
  });

  it('component 가 ABSTRACT 목록에 없으면 검사 생략 (MyCodeScene 등)', () => {
    const lec = makeLecture({
      scene_id: 5,
      narration: 'サイトが表示されました。',
      visual: { type: 'remotion', component: 'MyCodeScene', props: { code: '...' } },
    });
    expect(narrationVisualCoherenceRule.run(lec)).toHaveLength(0);
  });
});
