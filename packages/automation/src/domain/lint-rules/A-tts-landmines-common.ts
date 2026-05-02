/**
 * 카테고리 A — 엔진 무관 TTS 지뢰 (공통 사전).
 *
 * 발음·표기 정규화 단계로, ElevenLabs / Fish Audio 등 엔진 종류와 관계없이
 * 일본어 TTS 모델 다수가 흔들리는 패턴 모음. 자소 오독 같은 엔진 특이 회피는
 * `A-tts-landmines-elevenlabs.ts` / `A-tts-landmines-fish.ts` 에 둔다.
 */

export interface Landmine {
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

export const COMMON_LANDMINES: Landmine[] = [
  // C-1: カタカナ + 数字 (パート1 → パートワン 등)
  // 숫자를 카타카나로 읽을지 영어로 읽을지 흔들림. 엔진 종류와 무관하게 발생.
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

  // C-2: 漢字 발음 흔들림
  { pattern: /上半分/g, from: '上半分', to: '上のエリア', reason: '上半分 발음 흔들림 (じょうはんぶん/うえはんぶん)' },
  { pattern: /下半分/g, from: '下半分', to: '下のエリア', reason: '下半分 발음 흔들림' },
  // 段落: "だんらく" 가 "단다쿠" (だんだく 계열) 로 오독.
  { pattern: /段落/g, from: '段落', to: 'だんらく', reason: '段落 → "단다쿠" 오독. ひらがな 변환' },

  // C-3: 英語 약어 / 기호 (URL/혼합어 안의 우연 일치 회피)
  { pattern: /(?<![A-Za-z])gap(?![A-Za-z])/g, from: 'gap', to: 'ギャップ', reason: 'gap → "がっぷ" 로 오독' },
  { pattern: /(?<![A-Za-z])px(?![A-Za-z])/g, from: 'px', to: 'ピクセル', reason: 'px → "ピクセクる" 로 오독' },
  { pattern: /http:\/\//g, from: 'http://', to: 'エイチティーティーピーコロンスラッシュスラッシュ', reason: 'http:// 의 콜론을 "ころぶ" 로 오독' },
  // Authorize: CodePen↔GitHub 連携 버튼 라벨. 단어 경계에서만 (혼합어 회피, 대소문자 구분)
  { pattern: /(?<![A-Za-z])Authorize(?![A-Za-z])/g, from: 'Authorize', to: 'オーソライズ', reason: 'Authorize 영단어 오독 → 카타카나 변환' },

  // C-3b: 動詞 焦る (あせる) — TTS 가 "じら/じる" 등으로 오독
  { pattern: /焦ら/g, from: '焦ら', to: 'あせら', reason: '焦る 동사 → "じら" 오독 회피 (焦らない/焦らず/焦らなくて)' },
  { pattern: /焦り/g, from: '焦り', to: 'あせり', reason: '焦る 동사 → "じり" 오독 회피' },
  { pattern: /焦る/g, from: '焦る', to: 'あせる', reason: '焦る 동사 → "じる" 오독 회피' },
  { pattern: /焦って/g, from: '焦って', to: 'あせって', reason: '焦る 동사 → "じって" 오독 회피' },

  // C-4: HTML 見出しタグ h1~h6 (영문자+숫자 조합, "エイチワンチ" 등으로 오독)
  // 나레이션에서 단독 토큰으로 등장할 때만 검출 (URL, "高h1" 같은 혼합어 회피).
  { pattern: /(?<![A-Za-z0-9])h1(?![A-Za-z0-9])/g, from: 'h1', to: 'エイチワン', reason: 'h1 → "エイチワンチ" 등으로 오독' },
  { pattern: /(?<![A-Za-z0-9])h2(?![A-Za-z0-9])/g, from: 'h2', to: 'エイチツー', reason: 'h2 → 영문자+数字 오독' },
  { pattern: /(?<![A-Za-z0-9])h3(?![A-Za-z0-9])/g, from: 'h3', to: 'エイチスリー', reason: 'h3 → 영문자+数字 오독' },
  { pattern: /(?<![A-Za-z0-9])h4(?![A-Za-z0-9])/g, from: 'h4', to: 'エイチフォー', reason: 'h4 → 영문자+数字 오독' },
  { pattern: /(?<![A-Za-z0-9])h5(?![A-Za-z0-9])/g, from: 'h5', to: 'エイチファイブ', reason: 'h5 → 영문자+数字 오독' },
  { pattern: /(?<![A-Za-z0-9])h6(?![A-Za-z0-9])/g, from: 'h6', to: 'エイチシックス', reason: 'h6 → 영문자+数字 오독' },

  // C-5: 行の → ゴーの (漢字 行 を英語 go として오독)
  // 漢字に先行されている場合(改行の・実行の・進行の等)は複合語なので除외.
  {
    pattern: /(?<![一-龯])行の/g,
    from: '行の',
    to: 'ぎょうの',
    reason: '行の → "ゴーの" 오독 (行を英語 go として 읽음). 漢字先行の複合語は除外',
    fixPattern: /(?<![一-龯])行の/g,
  },

  // C-6: 改行 → "きゃいぎょう" 오독 (かいぎょう 여야 함). ひらがな 변환으로 회피
  { pattern: /改行/g, from: '改行', to: 'かいぎょう', reason: '改行 → "きゃいぎょう" 오독. ひらがな 변환' },
];
