/**
 * 카테고리 I — Playwright 씬의 audio (alignment.json) 와 narration 정합성 검증.
 *
 * #141 F-4: 사례 — lecture-02-03 씬 34 의 audio 가 narration 수정 후
 * 재생성되지 않아 sync-playwright 의 alignment 기반 phrase resolution 이 깨졌다.
 * (commit 9cb68a2 가 narration 의 따옴표 제거, 이후 audio 재생성 누락 → 13 chars diff)
 *
 * 검사 로직:
 *   - alignment.characters.join('') 와 scene.narration 비교
 *   - chars diff 가 0~3 → warning ("audio stale 의심, regen 검토")
 *   - chars diff > 3 → error ("audio stale, regen 필요")
 *
 * 주의:
 *   - alignment.json 이 없는 씬 (TTS 미생성) 은 skip — 정상 케이스
 *   - chars diff 의 작은 값(1~3) 은 chunk concat 시 silence 삽입 등의 정상 케이스도 있어 warning
 *   - error 임계는 #143 사례에서 13 chars diff 였으므로 4 이상으로 보수적 설정
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import { AsyncLintRule, LintIssue } from './types';
import { config } from '../../infrastructure/config';

const STALE_WARN_DIFF = 1;
const STALE_ERROR_DIFF = 4;

export const audioNarrationCoherenceRule: AsyncLintRule = {
  id: 'I-audio-narration-coherence',
  description: 'Playwright 씬 alignment.json 과 narration 정합성 검증 (TTS regen 누락 검출)',

  async run(lecture: any): Promise<LintIssue[]> {
    const issues: LintIssue[] = [];
    if (!lecture?.sequence || !Array.isArray(lecture.sequence)) return issues;
    if (typeof lecture.lecture_id !== 'string' || !lecture.lecture_id) return issues;

    const audioDir = path.join(config.paths.audio, lecture.lecture_id);
    if (!await fs.pathExists(audioDir)) return issues;

    for (const scene of lecture.sequence) {
      const sceneId = scene?.scene_id;
      if (typeof sceneId !== 'number') continue;
      if (typeof scene.narration !== 'string' || scene.narration.length === 0) continue;

      const alignmentPath = path.join(audioDir, `scene-${sceneId}.alignment.json`);
      if (!await fs.pathExists(alignmentPath)) continue;

      let alignmentText: string;
      try {
        const alignment = await fs.readJson(alignmentPath);
        if (!Array.isArray(alignment.characters)) continue;
        alignmentText = alignment.characters.join('');
      } catch {
        // 손상된 alignment 는 별도 룰 책임. 본 룰에서는 skip.
        continue;
      }

      const diff = Math.abs(alignmentText.length - scene.narration.length);
      if (diff < STALE_WARN_DIFF) continue;

      const severity = diff >= STALE_ERROR_DIFF ? 'error' : 'warning';
      const direction =
        alignmentText.length > scene.narration.length
          ? 'audio 가 narration 보다 김 (narration 에서 일부 텍스트 삭제됨)'
          : 'audio 가 narration 보다 짧음 (narration 에 일부 텍스트 추가됨)';
      issues.push({
        ruleId: 'I-audio-narration-coherence',
        sceneId,
        severity,
        message:
          `alignment ${alignmentText.length}자 vs narration ${scene.narration.length}자 (diff ${diff}) — ` +
          `${direction}. ` +
          `audio 가 stale 일 가능성. ` +
          `\`make regen-scene LECTURE=... SCENE=${sceneId}\` 로 TTS 재생성 권장.`,
      });
    }

    return issues;
  },
};
