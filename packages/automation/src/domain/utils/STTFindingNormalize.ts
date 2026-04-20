import { STTFinding } from '../interfaces/ISTTProvider';

/**
 * ひらがな (U+3041..U+3096) をカタカナ (U+30A1..U+30F6) に変換する。
 * `ぺん` ↔ `ペン`, `ぴー` ↔ `ピー` のような表記差を発音上等価とみなすため。
 */
function hiraganaToKatakana(s: string): string {
  return s.replace(/[\u3041-\u3096]/g, ch =>
    String.fromCharCode(ch.charCodeAt(0) + 0x60),
  );
}

/**
 * 比較用に文字列を正規化する:
 *  - Unicode NFKC (全角/半角統一、互換文字統一)
 *  - ひらがな → カタカナ統一 (発音は等価)
 *  - 括弧・引用符・スペース・改行・読点・句点の除去
 *
 * 発音比較の観点で「表記差しかない」ペアを等価にするための前処理。
 */
export function normalizeForCompare(s: string): string {
  return hiraganaToKatakana(s.normalize('NFKC'))
    .replace(/[「」『』（）()\[\]【】"'“”‘’\s　、。・,.\-]/g, '')
    .trim();
}

/**
 * 原文の英字パートを取り出した時、音声がカタカナで読むのは正しい動作。
 * 例: `CodePen` → `コードペン`, `HTML` → `エイチティーエムエル`, `Sign Up` → `サインアップ`.
 *
 * 条件:
 *  - expected に ASCII 英字が含まれる (日本語助詞が末尾/先頭に付いていてもよい)
 *  - actual がほぼカタカナのみ (長音符・中点を含む)
 *
 * この条件で差異が挙げられた場合、発音上は等価とみなして抑制する。
 */
export function isEnglishToKatakanaFalsePositive(expected: string, actual: string): boolean {
  const expectedNorm = normalizeForCompare(expected);
  const actualNorm = normalizeForCompare(actual);
  if (!expectedNorm || !actualNorm) return false;

  // expected から日本語助詞・ひらがな・漢字を剥がしても ASCII 英数字が残るか
  const expectedStrippedJa = expectedNorm.replace(/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/g, '');
  const hasEnglishCore = /[A-Za-z]/.test(expectedStrippedJa);
  if (!hasEnglishCore) return false;

  // actual が基本カタカナのみで構成されているか (長音符・中点含む)
  const isActualKatakanaOnly = /^[\u30A0-\u30FF]+$/.test(actualNorm);
  return isActualKatakanaOnly;
}

/**
 * finding を false positive 判定で抑制すべきか判定。
 * 現在のルール:
 *  - 正規化後に expected === actual (Gemini identical 오탐)
 *  - 英語→カタカナ 読みでの表記差
 */
export function shouldSuppressFinding(finding: STTFinding): boolean {
  const { expected, actual } = finding;
  if (normalizeForCompare(expected) === normalizeForCompare(actual)) return true;
  if (isEnglishToKatakanaFalsePositive(expected, actual)) return true;
  return false;
}
