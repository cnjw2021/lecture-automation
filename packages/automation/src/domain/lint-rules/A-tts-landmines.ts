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

  // A-6: ペイン → 店員 (P→T 자소 오독 계열, Hinata 보이스)
  // スペイン・ペイント・ペインティング 등 복합어는 제외.
  {
    pattern: /(?<![ァ-ヴーA-Za-z])ペイン(?![ァ-ヴーA-Za-z])/g,
    from: 'ペイン',
    to: 'パネル',
    reason: 'ペイン → "店員" 오독 (P→T 자소 오독 계열). スペイン・ペイント等の複合語は除外',
    fixPattern: /(?<![ァ-ヴーA-Za-z])ペイン(?![ァ-ヴーA-Za-z])/g,
  },
];

/**
 * 단순 문자열 치환을 적용하는 fix 함수 생성.
 * narration 안의 모든 매치를 한 번에 치환한다.
 */
function makeFix(sceneIdx: number, from: string, to: string) {
  return (lecture: any) => {
    const scene = lecture.sequence[sceneIdx];
    if (!scene || typeof scene.narration !== 'string') return;
    scene.narration = scene.narration.split(from).join(to);
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
    scene.narration = scene.narration.replace(pattern, to);
  };
}

export const ttsLandminesRule: LintRule = {
  id: 'A-tts-landmines',
  description: 'TTS 오독 패턴 검출 및 자동 수정 (パート1, 上半分, gap, px, http://, 行の, ペイン 등)',

  run(lecture: any): LintIssue[] {
    const issues: LintIssue[] = [];
    if (!lecture?.sequence || !Array.isArray(lecture.sequence)) return issues;

    lecture.sequence.forEach((scene: any, idx: number) => {
      const narration: string = typeof scene?.narration === 'string' ? scene.narration : '';
      if (!narration) return;

      for (const lm of LANDMINES) {
        const matches = narration.match(lm.pattern);
        if (!matches || matches.length === 0) continue;

        issues.push({
          ruleId: this.id,
          sceneId: scene.scene_id ?? null,
          severity: 'error',
          message: `「${lm.from}」→「${lm.to}」(${lm.reason}) — ${matches.length}회`,
          context: extractContext(narration, lm.from),
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
