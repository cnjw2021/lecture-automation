/**
 * 카테고리 A — TTS 지뢰 (ElevenLabs v3 기준).
 *
 * 사전(辞書) 출처: ~/.claude/projects/.../memory/project_tts_landmines.md
 * lecture-01-04 작업 중 4시간 시행착오 끝에 정리된 1차 데이터셋.
 *
 * 모든 항목은 자동 수정 가능 (단순 치환).
 */

import { LintIssue, LintRule } from './types';

interface Landmine {
  /** 검출 정규식. narration 필드에 적용. */
  pattern: RegExp;
  /** 치환 대상 문자열 (정확히 일치하는 부분만). */
  from: string;
  /** 치환 결과. */
  to: string;
  /** 사용자 보고용 메시지. */
  reason: string;
  /**
   * 치환 시 사용할 정규식. 지정하면 split/join 대신 regex.replace 를 사용.
   * lookbehind/lookahead 가 필요한 복합어 제외 케이스에 사용.
   */
  fixPattern?: RegExp;
}

const LANDMINES: Landmine[] = [
  // A-1: カタカナ + 数字 (パート1 → パートワン 등)
  { pattern: /パート1/g, from: 'パート1', to: 'パートワン', reason: 'カタカナ+数字 오독 회피' },
  { pattern: /パート2/g, from: 'パート2', to: 'パートツー', reason: 'カタカナ+数字 오독 회피' },
  { pattern: /パート3/g, from: 'パート3', to: 'パートスリー', reason: 'カタカナ+数字 오독 회피' },
  { pattern: /パート4/g, from: 'パート4', to: 'パートフォー', reason: 'カタカナ+数字 오독 회피' },
  { pattern: /パート5/g, from: 'パート5', to: 'パートファイブ', reason: 'カタカナ+数字 오독 회피' },
  { pattern: /セクション1/g, from: 'セクション1', to: 'セクションワン', reason: 'カタカナ+数字 오독 회피' },
  { pattern: /セクション2/g, from: 'セクション2', to: 'セクションツー', reason: 'カタカナ+数字 오독 회피' },
  { pattern: /セクション3/g, from: 'セクション3', to: 'セクションスリー', reason: 'カタカナ+数字 오독 회피' },
  { pattern: /ステップ1/g, from: 'ステップ1', to: 'ステップワン', reason: 'カタカナ+数字 오독 회피' },
  { pattern: /ステップ2/g, from: 'ステップ2', to: 'ステップツー', reason: 'カタカナ+数字 오독 회피' },
  { pattern: /ステップ3/g, from: 'ステップ3', to: 'ステップスリー', reason: 'カタカナ+数字 오독 회피' },

  // A-2: 漢字 발음 흔들림
  { pattern: /上半分/g, from: '上半分', to: '上のエリア', reason: '上半分 발음 흔들림 (じょうはんぶん/うえはんぶん)' },
  { pattern: /下半分/g, from: '下半分', to: '下のエリア', reason: '下半分 발음 흔들림' },
  // 段落: "だんらく" 가 "단다쿠" (だんだく 계열) 로 오독. ひらがな 로 회피.
  { pattern: /段落/g, from: '段落', to: 'だんらく', reason: '段落 → "단다쿠" 오독. ひらがな 변환' },

  // A-3: 英語 약어 오독
  // gap, px 는 단어 경계에서만 (URL/혼합어 안의 우연 일치 회피)
  { pattern: /(?<![A-Za-z])gap(?![A-Za-z])/g, from: 'gap', to: 'ギャップ', reason: 'gap → "がっぷ" 로 오독' },
  { pattern: /(?<![A-Za-z])px(?![A-Za-z])/g, from: 'px', to: 'ピクセル', reason: 'px → "ピクセクる" 로 오독' },
  { pattern: /http:\/\//g, from: 'http://', to: 'エイチティーティーピーコロンスラッシュスラッシュ', reason: 'http:// 의 콜론을 "ころぶ" 로 오독' },
  // Authorize: CodePen↔GitHub 연동 버튼 라벨. 단어 경계에서만 (혼합어 회피, 대소문자 구분)
  { pattern: /(?<![A-Za-z])Authorize(?![A-Za-z])/g, from: 'Authorize', to: 'オーソライズ', reason: 'Authorize 영단어 오독 → 카타카나 변환' },

  // A-3b: 動詞 焦る (あせる) — ElevenLabs v3 가 "じら/じる" 등으로 오독
  { pattern: /焦ら/g, from: '焦ら', to: 'あせら', reason: '焦る 동사 → "じら" 오독 회피 (焦らない/焦らず/焦らなくて)' },
  { pattern: /焦り/g, from: '焦り', to: 'あせり', reason: '焦る 동사 → "じり" 오독 회피' },
  { pattern: /焦る/g, from: '焦る', to: 'あせる', reason: '焦る 동사 → "じる" 오독 회피' },
  { pattern: /焦って/g, from: '焦って', to: 'あせって', reason: '焦る 동사 → "じって" 오독 회피' },

  // A-4: HTML 見出しタグ h1~h6 (영문자+숫자 조합, "エイチワンチ" 등으로 오독)
  // 나레이션에서 단독 토큰으로 등장할 때만 검출 (URL, "高h1" 같은 혼합어 회피).
  { pattern: /(?<![A-Za-z0-9])h1(?![A-Za-z0-9])/g, from: 'h1', to: 'エイチワン', reason: 'h1 → "エイチワンチ" 등으로 오독' },
  { pattern: /(?<![A-Za-z0-9])h2(?![A-Za-z0-9])/g, from: 'h2', to: 'エイチツー', reason: 'h2 → 영문자+数字 오독' },
  { pattern: /(?<![A-Za-z0-9])h3(?![A-Za-z0-9])/g, from: 'h3', to: 'エイチスリー', reason: 'h3 → 영문자+数字 오독' },
  { pattern: /(?<![A-Za-z0-9])h4(?![A-Za-z0-9])/g, from: 'h4', to: 'エイチフォー', reason: 'h4 → 영문자+数字 오독' },
  { pattern: /(?<![A-Za-z0-9])h5(?![A-Za-z0-9])/g, from: 'h5', to: 'エイチファイブ', reason: 'h5 → 영문자+数字 오독' },
  { pattern: /(?<![A-Za-z0-9])h6(?![A-Za-z0-9])/g, from: 'h6', to: 'エイチシックス', reason: 'h6 → 영문자+数字 오독' },

  // A-5: 行の → ゴーの (漢字 行 を英語 go として오독)
  // 漢字に先行されている場合(改行の・実行の・進行の等)は複合語なので除外。
  {
    pattern: /(?<![一-龯])行の/g,
    from: '行の',
    to: 'ぎょうの',
    reason: '行の → "ゴーの" 오독 (行を英語 go として읽음). 漢字先行の複合語は除外',
    fixPattern: /(?<![一-龯])行の/g,
  },

  // A-6: セットアップ → 이상 발음 (ップ 끝 P→T 자소 오독 계열, Hinata 보이스)
  { pattern: /セットアップ/g, from: 'セットアップ', to: 'せっとあっぷ', reason: 'セットアップ → 語尾プ がP→T오독 (Hinata 보이스). 히라가나로 회피' },

  // A-7: ペイン → 店員 (P→T 자소 오독 계열, Hinata 보이스)
  // スペイン・ペイント・ペインティング 등 복합어는 제외.
  {
    pattern: /(?<![ァ-ヴーA-Za-z])ペイン(?![ァ-ヴーA-Za-z])/g,
    from: 'ペイン',
    to: 'パネル',
    reason: 'ペイン → "店員" 오독 (P→T 자소 오독 계열). スペイン・ペイント等の複合語は除外',
    fixPattern: /(?<![ァ-ヴーA-Za-z])ペイン(?![ァ-ヴーA-Za-z])/g,
  },

  // A-8: ペン / Pen → テン 오독 (CodePen의 "Pen" 을 "Ten" 으로 오독)
  // 'ぺ'ん 형식(ASCII 아포스트로피로 문자 분리) 로 우회. 단독 ペン/Pen 만 대상.
  // ペンダント・ペンギン・ペンチ・スペイン 등 複合 カタカナ語 は 除外.
  // CodePen 같은 英단어 내 Pen 도 단어 경계로 除外.
  {
    pattern: /(?<![ァ-ヴー])ペン(?![ァ-ヴー])/g,
    from: 'ペン',
    to: "'ぺ'ん",
    reason: 'ペン → "テン" 오독 회피. 単独 ペン 만 대상, 複合 カタカナ語 除外',
    fixPattern: /(?<![ァ-ヴー])ペン(?![ァ-ヴー])/g,
  },
  {
    pattern: /(?<![A-Za-z])Pen(?![A-Za-z])/g,
    from: 'Pen',
    to: "'ぺ'ん",
    reason: 'Pen → "Ten" 오독 회피. CodePen 등 英단어 내 Pen 은 단어 경계로 除外',
    fixPattern: /(?<![A-Za-z])Pen(?![A-Za-z])/g,
  },

  // A-9: 改行 → "きゃいぎょう" 오독 (かいぎょう 여야 함). ひらがな 변환으로 회피
  // lecture-02-01 14:35 실측
  { pattern: /改行/g, from: '改行', to: 'かいぎょう', reason: '改行 → "きゃいぎょう" 오독. ひらがな 변환' },

  // A-10: ペア → "てあ" 오독 (P→T 자소 오독 계열, ペン 과 동일 패턴)
  // lecture-02-01 19:06 실측. 단독 ペア 만 대상, ペアレント・ペアリング 등 복합어 제외
  {
    pattern: /(?<![ァ-ヴー])ペア(?![ァ-ヴー])/g,
    from: 'ペア',
    to: "'ぺ'あ",
    reason: 'ペア → "てあ" 오독 (P→T 자소 오독 계열). 複合 カタカナ語 除外',
    fixPattern: /(?<![ァ-ヴー])ペア(?![ァ-ヴー])/g,
  },

  // A-11: タグ → "だぐ" 오독 (T→D 자소 오독). ひらがな + ASCII 따옴표 분리로 회피
  // lecture-02-01 19:33 실측. HTML タグ 설명 전반에 등장
  // ひらがな "たぐ" 만으로 부족해 토큰 경계를 강제 (ペン → 'ぺ'ん 과 동일 기법)
  { pattern: /タグ/g, from: 'タグ', to: "'たぐ'", reason: 'タグ → "だぐ" 오독 (T→D 자소 오독). ひらがな + ASCII 따옴표 분리' },
];

/**
 * Playwright 씬의 syncPoints[*].phrase 도 함께 치환.
 * narration 만 치환하면 phrase 가 narration 안에서 찾을 수 없게 되어
 * D-playwright-shape 룰이 "phrase 가 narration 안에 없음" 으로 차단한다.
 */
function applyToSyncPoints(scene: any, replacer: (s: string) => string) {
  const syncPoints = scene?.visual?.syncPoints;
  if (!Array.isArray(syncPoints)) return;
  for (const sp of syncPoints) {
    if (sp && typeof sp.phrase === 'string') {
      sp.phrase = replacer(sp.phrase);
    }
  }
}

/**
 * 단순 문자열 치환을 적용하는 fix 함수 생성.
 * narration + syncPoints[*].phrase 의 모든 매치를 한 번에 치환한다.
 */
function makeFix(sceneIdx: number, from: string, to: string) {
  return (lecture: any) => {
    const scene = lecture.sequence[sceneIdx];
    if (!scene || typeof scene.narration !== 'string') return;
    const replacer = (s: string) => s.split(from).join(to);
    scene.narration = replacer(scene.narration);
    applyToSyncPoints(scene, replacer);
  };
}

/**
 * 정규식 치환을 적용하는 fix 함수 생성.
 * lookbehind/lookahead 가 필요한 복합어 제외 케이스(行の, ペイン 등)에 사용.
 */
function makeRegexFix(sceneIdx: number, pattern: RegExp, to: string) {
  return (lecture: any) => {
    const scene = lecture.sequence[sceneIdx];
    if (!scene || typeof scene.narration !== 'string') return;
    const replacer = (s: string) => s.replace(new RegExp(pattern.source, pattern.flags), to);
    scene.narration = replacer(scene.narration);
    applyToSyncPoints(scene, replacer);
  };
}

export const ttsLandminesRule: LintRule = {
  id: 'A-tts-landmines',
  description: 'TTS 오독 패턴 검출 및 자동 수정 (パート1, 上半分, 段落, gap, px, http://, 行の, セットアップ, ペイン, ペン, Pen, 改行, ペア, タグ 등)',

  run(lecture: any): LintIssue[] {
    const issues: LintIssue[] = [];
    if (!lecture?.sequence || !Array.isArray(lecture.sequence)) return issues;

    lecture.sequence.forEach((scene: any, idx: number) => {
      const narration: string = typeof scene?.narration === 'string' ? scene.narration : '';
      const syncPoints: any[] = Array.isArray(scene?.visual?.syncPoints) ? scene.visual.syncPoints : [];
      const phrases: string[] = syncPoints
        .map((sp) => (sp && typeof sp.phrase === 'string' ? sp.phrase : ''))
        .filter(Boolean);

      for (const lm of LANDMINES) {
        // narration + syncPoints[*].phrase 양쪽 모두 검사.
        // fix 함수는 양쪽을 동시에 치환하므로, 어느 쪽이든 매치되면 한 번의 issue 로 모음.
        const narrMatches = narration ? narration.match(lm.pattern) : null;
        const phraseMatches = phrases.flatMap((p) => p.match(lm.pattern) || []);
        const total = (narrMatches?.length ?? 0) + phraseMatches.length;
        if (total === 0) continue;

        const sourceForContext = narration.includes(lm.from)
          ? narration
          : (phrases.find((p) => p.includes(lm.from)) ?? '');

        issues.push({
          ruleId: this.id,
          sceneId: scene.scene_id ?? null,
          severity: 'error',
          message: `「${lm.from}」→「${lm.to}」(${lm.reason}) — ${total}회`,
          context: extractContext(sourceForContext, lm.from),
          fix: lm.fixPattern
            ? makeRegexFix(idx, lm.fixPattern, lm.to)
            : makeFix(idx, lm.from, lm.to),
          fixDescription: `「${lm.from}」→「${lm.to}」`,
        });
      }
    });

    return issues;
  },
};

function extractContext(text: string, needle: string): string {
  const idx = text.indexOf(needle);
  if (idx === -1) return '';
  const start = Math.max(0, idx - 10);
  const end = Math.min(text.length, idx + needle.length + 10);
  const prefix = start > 0 ? '…' : '';
  const suffix = end < text.length ? '…' : '';
  return `${prefix}${text.slice(start, end)}${suffix}`;
}
