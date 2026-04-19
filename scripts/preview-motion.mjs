#!/usr/bin/env node
/**
 * no-audio 씬 모션 프리뷰를 MP4로 렌더링한다.
 *
 * 사용법:
 *   node scripts/preview-motion.mjs lecture-01-03.json 8
 *   node scripts/preview-motion.mjs lecture-01-03.json 8 150
 *   node scripts/preview-motion.mjs lecture-01-03.json 8 150 h264
 */

import { execFileSync } from 'child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const videoConfig = JSON.parse(readFileSync(join(ROOT, 'config', 'video.json'), 'utf8'));
const DEFAULT_DURATION = 600;
const DEFAULT_CODEC = 'h264';
const DEFAULT_FALLBACK_SCENE_SECONDS = 20;

const lectureFile = process.argv[2];
const sceneId = Number.parseInt(process.argv[3] ?? '', 10);
const durationArg = Number.parseInt(process.argv[4] ?? '', 10);
const codec = process.argv[5] || DEFAULT_CODEC;

if (!lectureFile || Number.isNaN(sceneId)) {
  console.log(`
🎞️ no-audio 모션 프리뷰 렌더

사용법:
  node scripts/preview-motion.mjs <lecture-file> <scene-id> [durationInFrames] [codec]

예시:
  node scripts/preview-motion.mjs lecture-01-03.json 8
  node scripts/preview-motion.mjs lecture-01-03.json 17 150
  node scripts/preview-motion.mjs lecture-01-03.json 37 120 prores
`);
  process.exit(0);
}

const dataPath = join(ROOT, 'data', lectureFile);
if (!existsSync(dataPath)) {
  console.error(`❌ 강의 파일을 찾을 수 없습니다: ${dataPath}`);
  process.exit(1);
}

const lectureData = JSON.parse(readFileSync(dataPath, 'utf-8'));
const scene = lectureData.sequence.find(entry => entry.scene_id === sceneId);

if (!scene) {
  console.error(`❌ 씬 ${sceneId}을(를) 찾을 수 없습니다.`);
  console.error(`사용 가능한 씬: ${lectureData.sequence.map(entry => entry.scene_id).join(', ')}`);
  process.exit(1);
}

const componentName = scene.visual.component || scene.visual.type || 'Unknown';
const outputDir = join(ROOT, 'output', 'preview-motion', lectureData.lecture_id);
if (!existsSync(outputDir)) {
  mkdirSync(outputDir, { recursive: true });
}

const durationInFrames = Number.isFinite(durationArg)
  ? durationArg
  : Math.max(
      Math.ceil((scene.durationSec ?? DEFAULT_FALLBACK_SCENE_SECONDS) * videoConfig.fps),
      videoConfig.fps * 4
    );

const outputExtension = (() => {
  if (codec === 'prores') return 'mov';
  if (codec === 'vp8' || codec === 'vp9') return 'webm';
  if (codec === 'gif') return 'gif';
  return 'mp4';
})();

const outputPath = join(outputDir, `scene-${sceneId}-${componentName}-${durationInFrames}f.${outputExtension}`);
const inputProps = {
  lectureData,
  sceneId,
  durationInFrames,
};
const propsTempDir = mkdtempSync(join(tmpdir(), 'lecture-preview-props-'));
const propsFilePath = join(propsTempDir, `scene-${sceneId}.json`);
writeFileSync(propsFilePath, JSON.stringify(inputProps), 'utf8');

console.log(`🎞️ 모션 프리뷰 렌더링 중...`);
console.log(`   강의: ${lectureFile}`);
console.log(`   씬: ${sceneId} (${componentName})`);
console.log(`   길이: ${durationInFrames} frames`);
console.log(`   코덱: ${codec}`);

try {
  execFileSync(
    'npx',
    [
      'remotion',
      'render',
      'src/PreviewRoot.tsx',
      'PreviewScene',
      outputPath,
      `--codec=${codec}`,
      `--props=${propsFilePath}`,
    ],
    {
      cwd: join(ROOT, 'packages/remotion'),
      stdio: 'inherit',
    }
  );
} finally {
  rmSync(propsTempDir, { recursive: true, force: true });
}

console.log(`\n✅ 모션 프리뷰 저장 완료: ${outputPath}`);
