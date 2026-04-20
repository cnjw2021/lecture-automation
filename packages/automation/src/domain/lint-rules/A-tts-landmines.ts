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

export const ttsLandminesRule: LintRule = {
  id: 'A-tts-landmines',
  description: 'TTS 오독 패턴 검출 및 자동 수정 (パート1, 上半分, gap, px, http:// 등)',

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
          fix: makeFix(idx, lm.from, lm.to),
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
