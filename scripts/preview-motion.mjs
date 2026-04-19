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
import { existsSync, mkdirSync, readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DEFAULT_DURATION = 180;
const DEFAULT_CODEC = 'h264';

const lectureFile = process.argv[2];
const sceneId = Number.parseInt(process.argv[3] ?? '', 10);
const durationInFrames = Number.parseInt(process.argv[4] ?? '', 10) || DEFAULT_DURATION;
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

const outputPath = join(outputDir, `scene-${sceneId}-${componentName}-${durationInFrames}f.mp4`);
const inputProps = JSON.stringify({
  lectureData,
  sceneId,
  durationInFrames,
});

console.log(`🎞️ 모션 프리뷰 렌더링 중...`);
console.log(`   강의: ${lectureFile}`);
console.log(`   씬: ${sceneId} (${componentName})`);
console.log(`   길이: ${durationInFrames} frames`);
console.log(`   코덱: ${codec}`);

execFileSync(
  'npx',
  [
    'remotion',
    'render',
    'src/PreviewRoot.tsx',
    'PreviewScene',
    outputPath,
    `--codec=${codec}`,
    `--props=${inputProps}`,
  ],
  {
    cwd: join(ROOT, 'packages/remotion'),
    stdio: 'inherit',
  }
);

console.log(`\n✅ 모션 프리뷰 저장 완료: ${outputPath}`);
