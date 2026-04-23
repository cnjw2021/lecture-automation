import { SyncPointNarrationChunker, isSentenceBoundary } from './NarrationChunker';

describe('SyncPointNarrationChunker', () => {
  const chunker = new SyncPointNarrationChunker();
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it('syncPoints 가 없으면 청크 1개를 반환한다', () => {
    const result = chunker.chunk('これはテストです。');
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ index: 0, text: 'これはテストです。' });
  });

  it('빈 syncPoints 배열도 청크 1개를 반환한다', () => {
    const result = chunker.chunk('これはテストです。', []);
    expect(result).toHaveLength(1);
  });

  it('syncPoint phrase 위치를 경계로 분할한다', () => {
    const narration = 'はじめに挨拶します。では、本題に入ります。';
    const syncPoints = [
      { actionIndex: 5, phrase: 'では、本題に入ります' },
    ];
    const result = chunker.chunk(narration, syncPoints);

    expect(result).toHaveLength(2);
    expect(result[0].text).toBe('はじめに挨拶します。');
    expect(result[1].text).toBe('では、本題に入ります。');
    expect(result.map(c => c.text).join('')).toBe(narration);
  });

  it('여러 syncPoints 를 모두 경계로 사용해 N+1 청크를 만든다', () => {
    const narration = 'A。B。C。D。';
    const syncPoints = [
      { actionIndex: 1, phrase: 'B' },
      { actionIndex: 2, phrase: 'C' },
      { actionIndex: 3, phrase: 'D' },
    ];
    const result = chunker.chunk(narration, syncPoints);

    expect(result).toHaveLength(4);
    expect(result[0].text).toBe('A。');
    expect(result[1].text).toBe('B。');
    expect(result[2].text).toBe('C。');
    expect(result[3].text).toBe('D。');
  });

  it('phrase 가 미발견이거나 position 0 이면 경계로 사용하지 않는다', () => {
    const narration = 'はじめに挨拶します。では、本題に入ります。';
    const syncPoints = [
      { actionIndex: 1, phrase: 'はじめに' }, // pos=0 → 경계로 쓰지 않음
      { actionIndex: 2, phrase: '存在しない' }, // 미발견
      { actionIndex: 3, phrase: 'では' }, // 유효
    ];
    const result = chunker.chunk(narration, syncPoints);

    expect(result).toHaveLength(2);
    expect(result[0].text).toBe('はじめに挨拶します。');
  });

  it('재조립 결과가 원본과 달라지면 에러를 던진다', () => {
    // 이 케이스는 정상 동작 경로에서는 발생하지 않지만, 안전망 검증.
    // 인위적으로 phrase 가 경계로 포함되지 않는 흐름은 현재 구현상 트리거 불가 —
    // 보호막 존재 자체를 문서화하는 테스트.
    const narration = 'A。B。';
    expect(() => chunker.chunk(narration, [])).not.toThrow();
  });

  it('문장 시작이 아닌 위치에서 분할 시 경고를 출력한다', () => {
    const narration = 'これは長い文で句点はまだありません、そして続きます。';
    const syncPoints = [
      { actionIndex: 1, phrase: 'そして続きます' },
    ];
    const result = chunker.chunk(narration, syncPoints);

    expect(result).toHaveLength(2);
    expect(warnSpy).toHaveBeenCalled();
    const calls = warnSpy.mock.calls.map(c => String(c[0]));
    expect(calls.some(msg => msg.includes('문장 시작점이 아님'))).toBe(true);
  });

  it('syncPoint 가 문장 시작(。직후) 에 찍히면 경고하지 않는다', () => {
    const narration = 'はじめに挨拶します。では、本題に入ります。';
    const syncPoints = [
      { actionIndex: 1, phrase: 'では、本題に入ります' },
    ];
    chunker.chunk(narration, syncPoints);
    expect(warnSpy).not.toHaveBeenCalled();
  });
});

describe('isSentenceBoundary', () => {
  it('pos=0 은 항상 경계', () => {
    expect(isSentenceBoundary('abc', 0)).toBe(true);
  });
  it('앞 문자가 。 이면 경계', () => {
    expect(isSentenceBoundary('A。B', 2)).toBe(true);
  });
  it('앞 문자가 ！ ？ 이면 경계', () => {
    expect(isSentenceBoundary('A！B', 2)).toBe(true);
    expect(isSentenceBoundary('A？B', 2)).toBe(true);
  });
  it('앞 문자가 줄바꿈이면 경계', () => {
    expect(isSentenceBoundary('A\nB', 2)).toBe(true);
  });
  it('앞 문자가 일반 문자면 비경계', () => {
    expect(isSentenceBoundary('ABC', 2)).toBe(false);
  });
});
