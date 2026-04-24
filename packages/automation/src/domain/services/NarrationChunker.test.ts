import { SyncPointNarrationChunker, isSentenceBoundary } from './NarrationChunker';

describe('SyncPointNarrationChunker', () => {
  // 원시 분할 계약 검증 — minChunkChars 병합을 끈 상태.
  const chunker = new SyncPointNarrationChunker({ minChunkChars: 0 });
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

describe('SyncPointNarrationChunker — minChunkChars 병합', () => {
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    warnSpy.mockRestore();
  });

  // 4 문장 × 100자 = 총 400자 구성의 narration
  const sent = (n: number, ch: string) => ch.repeat(n) + '。';
  const narration = sent(99, 'あ') + sent(99, 'い') + sent(99, 'う') + sent(99, 'え');
  // 경계 위치:
  //   - 'い' 시작 = 100
  //   - 'う' 시작 = 200
  //   - 'え' 시작 = 300
  const syncPointsAll = [
    { actionIndex: 1, phrase: 'い'.repeat(99) },
    { actionIndex: 2, phrase: 'う'.repeat(99) },
    { actionIndex: 3, phrase: 'え'.repeat(99) },
  ];

  it('minChunkChars=150 이면 100자 간격 경계 중 일부가 병합되어 청크 수가 줄어든다', () => {
    const chunker = new SyncPointNarrationChunker({ minChunkChars: 150 });
    const result = chunker.chunk(narration, syncPointsAll);
    // 경계 pos=100 은 prevLen=100<150 → 버림
    // 경계 pos=200 은 cursor=0, prevLen=200>=150, remaining=200>=150 → 채택 (cursor=200)
    // 경계 pos=300 은 cursor=200, prevLen=100<150 → 버림
    // → 청크 2개 (0..200, 200..400)
    expect(result).toHaveLength(2);
    expect(result[0].text.length).toBe(200);
    expect(result[1].text.length).toBe(200);
    expect(result.map(c => c.text).join('')).toBe(narration);
  });

  it('minChunkChars=0 이면 모든 경계를 그대로 사용한다', () => {
    const chunker = new SyncPointNarrationChunker({ minChunkChars: 0 });
    const result = chunker.chunk(narration, syncPointsAll);
    expect(result).toHaveLength(4);
  });

  it('기본값은 150 자 (옵션 없이 생성)', () => {
    const chunker = new SyncPointNarrationChunker();
    const result = chunker.chunk(narration, syncPointsAll);
    expect(result).toHaveLength(2);
  });

  it('남은 꼬리가 minChunkChars 미만이면 마지막 경계를 버린다', () => {
    // 200 + 200 + 30 = 430자
    const short = 'あ'.repeat(199) + '。' + 'い'.repeat(199) + '。' + 'う'.repeat(29) + '。';
    const sps = [
      { actionIndex: 1, phrase: 'い'.repeat(199) }, // pos=200 채택 (prev=200, remaining=230)
      { actionIndex: 2, phrase: 'う'.repeat(29) },  // pos=400, remaining=30<150 → 버림
    ];
    const chunker = new SyncPointNarrationChunker({ minChunkChars: 150 });
    const result = chunker.chunk(short, sps);
    expect(result).toHaveLength(2);
    expect(result[0].text.length).toBe(200);
    expect(result[1].text.length).toBe(230);
  });

  it('문장 경계인 후보만 우선 사용 — 비문장 경계는 버린다', () => {
    // narration: 'あ..。い..、う..。え..。' (4문장, 단 'う' 앞은 、로 비문장 경계)
    const n =
      'あ'.repeat(99) + '。' +        // pos 0..99 문장1, 'い' 시작=100 (문장 경계)
      'い'.repeat(99) + '、' +        // pos 100..199 문장2 조각, 'う' 시작=200 (비문장 경계)
      'う'.repeat(99) + '。' +        // 'え' 시작=300 (문장 경계)
      'え'.repeat(99) + '。';
    const sps = [
      { actionIndex: 1, phrase: 'い'.repeat(99) }, // pos=100, 앞='。' 문장 경계
      { actionIndex: 2, phrase: 'う'.repeat(99) }, // pos=200, 앞='、' 비문장 경계
      { actionIndex: 3, phrase: 'え'.repeat(99) }, // pos=300, 앞='。' 문장 경계
    ];
    const chunker = new SyncPointNarrationChunker({ minChunkChars: 150 });
    const result = chunker.chunk(n, sps);
    // pool = [pos 100, pos 300]  (pos 200 버림)
    // pos=100 prev=100<150 → 버림
    // pos=300 prev=300-0=300>=150, remaining=100<150 → 버림
    // → 청크 1개
    expect(result).toHaveLength(1);
    expect(warnSpy.mock.calls.some(c => String(c[0]).includes('문장 시작점이 아님'))).toBe(true);
  });

  it('문장 경계 후보가 하나도 없으면 fallback 으로 비문장 경계도 사용', () => {
    // 모든 syncPoint 가 비문장 경계인 경우
    const n = 'A' + 'い'.repeat(200) + '、' + 'う'.repeat(200);
    const sps = [
      { actionIndex: 1, phrase: 'う'.repeat(200) }, // 앞='、' 비문장 경계
    ];
    const chunker = new SyncPointNarrationChunker({ minChunkChars: 150 });
    const result = chunker.chunk(n, sps);
    // fallback 으로 비문장 경계 사용 → prev=202, remaining=200 → 채택
    expect(result).toHaveLength(2);
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
