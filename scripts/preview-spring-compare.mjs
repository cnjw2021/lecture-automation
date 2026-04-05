#!/usr/bin/env node
/**
 * 스프링 프리셋별 멀티프레임 비교 프리뷰 생성
 *
 * 각 프리셋(default·gentle·bouncy·snappy·smooth)을
 * 프레임 5·15·30에서 캡처해 애니메이션 진행 양상을 비교합니다.
 *
 * 사용법:
 *   make preview-springs
 *   node scripts/preview-spring-compare.mjs
 */

import { execSync } from 'child_process';
import { readFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const LECTURE_FILE = 'sample-spring-compare.json';
const FRAMES = [5, 15, 30];

const dataPath = join(ROOT, 'data', LECTURE_FILE);
const lectureData = JSON.parse(readFileSync(dataPath, 'utf-8'));
const remotionDir = join(ROOT, 'packages/remotion');

console.log('🎬 스프링 프리셋 비교 프리뷰 생성 시작\n');
console.log(`  프리셋: ${lectureData.sequence.map(s => s.visual.props.title).join(' · ')}`);
console.log(`  프레임: ${FRAMES.join(', ')}\n`);

let successCount = 0;
let failCount = 0;

for (const scene of lectureData.sequence) {
  const presetName = scene.visual.props.title;
  const componentName = scene.visual.component;
  const componentProps = scene.visual.props;

  const outputDir = join(ROOT, 'output', 'preview', lectureData.lecture_id, presetName);
  if (!existsSync(outputDir)) mkdirSync(outputDir, { recursive: true });

  for (const frame of FRAMES) {
    const outputPath = join(outputDir, `f${String(frame).padStart(2, '0')}.png`);
    const inputProps = JSON.stringify({ componentName, props: componentProps });
    const cmd = [
      'npx remotion still',
      'src/Root.tsx',
      'Preview',
      `"${outputPath}"`,
      `--frame=${frame}`,
      `--props='${inputProps}'`,
      '--log=error',
    ].join(' ');

    try {
      execSync(cmd, { cwd: remotionDir, stdio: 'pipe', timeout: 60000 });
      console.log(`  ✅ ${presetName} / frame ${frame} → ${outputPath.replace(ROOT + '/', '')}`);
      successCount++;
    } catch {
      console.log(`  ❌ ${presetName} / frame ${frame} 실패`);
      failCount++;
    }
  }
  console.log('');
}

const outputBase = join(ROOT, 'output', 'preview', lectureData.lecture_id);
console.log(`완료: 성공 ${successCount}개 / 실패 ${failCount}개`);
console.log(`📁 저장 위치: output/preview/${lectureData.lecture_id}/`);
console.log('');
console.log('디렉토리 구조:');
console.log('  {프리셋명}/');
console.log('    f05.png  ← 애니메이션 시작 직후');
console.log('    f15.png  ← 중간');
console.log('    f30.png  ← 거의 정착');

if (process.platform === 'darwin') {
  execSync(`open "${outputBase}"`);
}
