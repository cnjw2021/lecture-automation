/**
 * 카테고리 A — Fish Audio (speech-1.6) 전용 TTS 지뢰.
 *
 * Fish Audio speech-1.6 모델이 일본어 나레이션 안에 등장하는 영어 단어·기호를
 * 일본어가 아닌 영어식 발음으로 처리하면서 발생하는 오독 모음.
 * lecture-02-04 first generation (2026-05-02) 에서 실측된 패턴이 SSoT.
 *
 * 회피 전략:
 * - HTML 엘리먼트 이름 (header, footer, div 등) → 카타카나 변환
 * - HTML 기호 / 엔티티 (#, &copy;, @) → 일본어로 풀어 씀
 * - 단독 영문자 (a) → 일본어 알파벳 명칭 (エー)
 * - URL 프래그먼트 값 (about / hobby / links) → 카타카나 변환
 *
 * ElevenLabs Hinata 의 P→T / T→D 자소 오독 같은 모델 특이 패턴은 여기 등장하지 않는다.
 */

import { Landmine } from './A-tts-landmines-common';

export const FISH_LANDMINES: Landmine[] = [
  // F-1: HTML 엘리먼트 이름 (영어 단어를 일본어 나레이션 안에서 영어식으로 오독)
  // lecture-02-04 실측: footer → "후튜-", article → "아-티큐르", div → "다이브",
  //                    img → "이엠지", input → "인못또", button → "바톤"
  // 단어 경계에서만 (혼합어/URL 안의 우연 일치 회피).
  {
    pattern: /(?<![A-Za-z])header(?![A-Za-z])/g,
    from: 'header',
    to: 'ヘッダー',
    reason: 'Fish: header 영어 발음 회피. カタカナ 변환',
    fixPattern: /(?<![A-Za-z])header(?![A-Za-z])/g,
  },
  {
    pattern: /(?<![A-Za-z])footer(?![A-Za-z])/g,
    from: 'footer',
    to: 'フッター',
    reason: 'Fish: footer → "후튜-" 오독. カタカナ 변환',
    fixPattern: /(?<![A-Za-z])footer(?![A-Za-z])/g,
  },
  {
    pattern: /(?<![A-Za-z])nav(?![A-Za-z])/g,
    from: 'nav',
    to: 'ナビ',
    reason: 'Fish: nav 영어 발음 회피. カタカナ 변환',
    fixPattern: /(?<![A-Za-z])nav(?![A-Za-z])/g,
  },
  {
    pattern: /(?<![A-Za-z])main(?![A-Za-z])/g,
    from: 'main',
    to: 'メイン',
    reason: 'Fish: main 영어 발음 회피. カタカナ 변환',
    fixPattern: /(?<![A-Za-z])main(?![A-Za-z])/g,
  },
  {
    pattern: /(?<![A-Za-z])section(?![A-Za-z])/g,
    from: 'section',
    to: 'セクション',
    reason: 'Fish: section 영어 발음 회피. カタカナ 변환',
    fixPattern: /(?<![A-Za-z])section(?![A-Za-z])/g,
  },
  {
    pattern: /(?<![A-Za-z])article(?![A-Za-z])/g,
    from: 'article',
    to: 'アーティクル',
    reason: 'Fish: article → "아-티큐르" 오독. カタカナ 변환',
    fixPattern: /(?<![A-Za-z])article(?![A-Za-z])/g,
  },
  {
    pattern: /(?<![A-Za-z])div(?![A-Za-z])/g,
    from: 'div',
    to: 'ディブ',
    reason: 'Fish: div → "다이브" 오독. カタカナ 변환',
    fixPattern: /(?<![A-Za-z])div(?![A-Za-z])/g,
  },
  {
    pattern: /(?<![A-Za-z])img(?![A-Za-z])/g,
    from: 'img',
    to: 'アイエムジー',
    reason: 'Fish: img → "이엠지" 알파벳 단음 오독. アイエムジー 로 풀어서 변환',
    fixPattern: /(?<![A-Za-z])img(?![A-Za-z])/g,
  },
  {
    pattern: /(?<![A-Za-z])input(?![A-Za-z])/g,
    from: 'input',
    to: 'インプット',
    reason: 'Fish: input → "인못또" 오독. カタカナ 변환',
    fixPattern: /(?<![A-Za-z])input(?![A-Za-z])/g,
  },
  {
    pattern: /(?<![A-Za-z])button(?![A-Za-z])/g,
    from: 'button',
    to: 'ボタン',
    reason: 'Fish: button → "바톤" 오독. カタカナ 변환',
    fixPattern: /(?<![A-Za-z])button(?![A-Za-z])/g,
  },
  {
    pattern: /(?<![A-Za-z])span(?![A-Za-z])/g,
    from: 'span',
    to: 'スパン',
    reason: 'Fish: span 영어 발음 회피 (preemptive). カタカナ 변환',
    fixPattern: /(?<![A-Za-z])span(?![A-Za-z])/g,
  },

  // F-2: 단독 영문자 'a' (HTML a 태그 참조)
  // lecture-02-04 실측 씬 33: a → "아" (단음 오독).
  // 단어 경계에서만 (about, and, apple 등 일반 영단어 안의 a 는 제외).
  {
    pattern: /(?<![A-Za-z0-9])a(?![A-Za-z0-9])/g,
    from: 'a',
    to: 'エー',
    reason: "Fish: 'a' 단독 → \"아\" 단음 오독. IT 표준은 알파벳 명칭 \"エー\". カタカナ 변환",
    fixPattern: /(?<![A-Za-z0-9])a(?![A-Za-z0-9])/g,
  },

  // F-3: URL 프래그먼트 / 속성값 (lecture-02-04 자기소개 페이지의 about/hobby/links)
  // lecture-02-04 씬 38 실측: #about → "샨독쇼토쿠" (# 와 about 가 결합 오독).
  // # → シャープ 단독 변환과 결합하여 #about → シャープアバウト 처럼 자연스러운 일본어 발음으로.
  {
    pattern: /(?<![A-Za-z])about(?![A-Za-z])/g,
    from: 'about',
    to: 'アバウト',
    reason: 'Fish: about 영어 발음 회피 (#about/id="about" 등). カタカナ 변환',
    fixPattern: /(?<![A-Za-z])about(?![A-Za-z])/g,
  },
  {
    pattern: /(?<![A-Za-z])hobby(?![A-Za-z])/g,
    from: 'hobby',
    to: 'ホビー',
    reason: 'Fish: hobby 영어 발음 회피. カタカナ 변환',
    fixPattern: /(?<![A-Za-z])hobby(?![A-Za-z])/g,
  },
  {
    pattern: /(?<![A-Za-z])links(?![A-Za-z])/g,
    from: 'links',
    to: 'リンクス',
    reason: 'Fish: links 영어 발음 회피. カタカナ 변환',
    fixPattern: /(?<![A-Za-z])links(?![A-Za-z])/g,
  },

  // F-4: HTML 기호 / 엔티티
  // lecture-02-04 씬 19/35/36/38 실측: # → "사브-" / "샥토" / "샨독쇼토쿠" 등 비결정적 오독.
  // → "シャープ" 로 통일 (URL 프래그먼트 일반적 일본어 발음).
  { pattern: /#/g, from: '#', to: 'シャープ', reason: 'Fish: # → "사브-" / "샥토" 등 비결정적 오독. シャープ 로 변환' },
  // lecture-02-04 씬 25 실측: &copy; → "안도 카마" 오독 (& 와 copy 가 결합).
  // → "アンドコピーセミコロン" 로 풀어 씀 (http:// 의 풀어쓰기 패턴과 동일 기법).
  { pattern: /&copy;/g, from: '&copy;', to: 'アンドコピーセミコロン', reason: 'Fish: &copy; → "안도 카마" 오독. アンドコピーセミコロン 로 풀어서 변환' },
  // lecture-02-04 씬 25 실측: @ → "에띠에?" 오독.
  // → "アット" 로 변환 (이메일 주소 일반적 일본어 발음).
  { pattern: /@/g, from: '@', to: 'アット', reason: 'Fish: @ → "에띠에" 오독. アット 로 변환' },
];
