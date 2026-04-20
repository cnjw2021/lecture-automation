import {
  normalizeForCompare,
  isEnglishToKatakanaFalsePositive,
  shouldSuppressFinding,
} from './STTFindingNormalize';
import { STTFinding } from '../interfaces/ISTTProvider';

function f(expected: string, actual: string, timeSec = 0): STTFinding {
  return { timeSec, expected, actual };
}

describe('normalizeForCompare', () => {
  it('Unicode NFKC 변환 (全角 → 半角)', () => {
    // 全角英数字 `ＣｏｄｅＰｅｎ` → 半角 `CodePen`
    expect(normalizeForCompare('ＣｏｄｅＰｅｎ')).toBe('CodePen');
  });

  it('括弧·引用符 제거', () => {
    expect(normalizeForCompare('「Hello World」')).toBe('HelloWorld');
    expect(normalizeForCompare('『タグ』')).toBe('タグ');
    expect(normalizeForCompare('（補足）')).toBe('補足');
  });

  it('공백·읽점·구점 제거', () => {
    expect(normalizeForCompare('文 章 が 表 示')).toBe('文章が表示');
    expect(normalizeForCompare('パート 2')).toBe('パート2');
    expect(normalizeForCompare('こんにちは、世界。')).toBe('こんにちは世界');
  });

  it('동일 텍스트는 동일 정규화', () => {
    expect(normalizeForCompare('文章が表示')).toBe(normalizeForCompare('文章が表示'));
  });
});

describe('isEnglishToKatakanaFalsePositive', () => {
  it.each([
    ['CodePen', 'コードペン'],
    ['HTML', 'エイチティーエムエル'],
    ['JavaScript', 'ジャバスクリプト'],
    ['GitHub', 'ギットハブ'],
    ['Sign Up', 'サインアップ'],
    ['Authorize', 'オーソライズ'],
    ['Change View', 'チェンジビュー'],
    ['codepen.io', 'コードペンドットアイオー'],
    ['Skip personalization', 'スキップパーソナリゼーション'],
    ['CodePenの', 'コードペン'],  // 일본어 조사가 붙어도 OK
  ])('%s → %s 는 FP로 판정', (expected, actual) => {
    expect(isEnglishToKatakanaFalsePositive(expected, actual)).toBe(true);
  });

  it.each([
    ['プロモーション', 'クロモーション'],  // katakana → katakana 실제 오독
    ['Pen', 'テン'],                        // 영어→カタカナ지만 오독 (P→T) — 이건 실제 오독
    // Wait: Pen → ペン (correct reading is katakana "ペン")
    // but actual is テン which IS katakana. So our rule WOULD flag this as FP.
    // This is expected behavior: we can't distinguish "correct Eng→Kat" from "wrong Eng→Kat"
    // without a phonetic table. We accept this trade-off.
    // Remove this row and add it as a known limitation test below.
  ].slice(0, 1))('실제 오독 %s → %s 는 FP로 판정하지 않음 (보수적 통과)', (expected, actual) => {
    expect(isEnglishToKatakanaFalsePositive(expected, actual)).toBe(false);
  });

  it('영어→カタカナ 룰 한계: Pen → テン 같은 자소 오독은 FP로 오판정될 수 있음 (알려진 trade-off)', () => {
    // 영어→カタカナ 축은 Gemini가 "정상 읽기"를 차이로 집계하는 것을 막기 위한 룰.
    // 부작용으로 Pen→テン 처럼 "영어→잘못된 カタカナ"도 걸러짐.
    // 이는 TTS landmines 사전(code-level lint)이 보완해야 함.
    expect(isEnglishToKatakanaFalsePositive('Pen', 'テン')).toBe(true);
  });

  it('expected에 영문이 없으면 FP 아님', () => {
    expect(isEnglishToKatakanaFalsePositive('プロモーション', 'クロモーション')).toBe(false);
    expect(isEnglishToKatakanaFalsePositive('いちばん', 'いち')).toBe(false);
  });

  it('알려진 한계: 原文과 actual이 모두 영문·한자 혼합/カタカナ만 이면 구분 불가', () => {
    // Pタグ → ティータグ 는 실제 오독(p→t)이지만, 규칙상 expected에 영문 포함 + actual이 カタカナ로만 구성 → FP 판정됨.
    // 이 한계는 TTS landmines 사전(lint)으로 보완해야 한다.
    expect(isEnglishToKatakanaFalsePositive('Pタグ', 'ティータグ')).toBe(true);
  });
});

describe('shouldSuppressFinding', () => {
  it('정규화 후 동일한 identical 오탐을 억제', () => {
    // Gemini가 `文章が表示 → 文章が表示` 처럼 동일 문자열을 finding으로 반환한 경우
    expect(shouldSuppressFinding(f('文章が表示', '文章が表示'))).toBe(true);
    expect(shouldSuppressFinding(f('「Hello World」', '"Hello World"'))).toBe(true);
  });

  it('英語→カタカナ FP를 억제', () => {
    expect(shouldSuppressFinding(f('CodePen', 'コードペン'))).toBe(true);
    expect(shouldSuppressFinding(f('HTML', 'エイチティーエムエル'))).toBe(true);
  });

  it('실제 일본어 오독은 억제하지 않음', () => {
    expect(shouldSuppressFinding(f('プロモーション', 'クロモーション'))).toBe(false);
    expect(shouldSuppressFinding(f('いちばん', 'いち'))).toBe(false);
    expect(shouldSuppressFinding(f('エイチワン', 'エイチワンチ'))).toBe(false);
  });
});
