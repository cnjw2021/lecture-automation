#!/usr/bin/env node
/**
 * 특정 씬의 컴포넌트를 PNG 이미지로 빠르게 렌더링하는 프리뷰 스크립트
 *
 * 사용법:
 *   make preview SCENE=6                  # 씬 6을 프레임 45에서 캡처
 *   make preview SCENE=6 FRAME=0          # 씬 6을 프레임 0에서 캡처
 *   make preview SCENE=1 LECTURE=p1-01-01.json
 *
 * 또는 직접 실행:
 *   node scripts/preview.mjs p1-01-01.json 6 45
 */

import { execSync } from 'child_process';
import { readFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const lectureFile = process.argv[2] || 'p1-01-01.json';
const sceneId = parseInt(process.argv[3], 10);
const frameNum = parseInt(process.argv[4], 10) || 45;

if (!sceneId || isNaN(sceneId)) {
  console.log(`
📸 컴포넌트 프리뷰 — 특정 씬을 PNG로 빠르게 확인

사용법:
  make preview SCENE=<씬번호>                     # 기본 프레임 45
  make preview SCENE=<씬번호> FRAME=<프레임번호>   # 프레임 지정
  make preview SCENE=<씬번호> LECTURE=<파일명>     # 강의 파일 지정

예시:
  make preview SCENE=1          → TitleScreen 프리뷰
  make preview SCENE=6          → DiagramScreen 프리뷰
  make preview SCENE=7 FRAME=60 → DiagramScreen(AIツール) 프레임 60
`);
  process.exit(0);
}

// 강의 데이터 로드
const dataPath = join(ROOT, 'data', lectureFile);
if (!existsSync(dataPath)) {
  console.error(`❌ 강의 파일을 찾을 수 없습니다: ${dataPath}`);
  process.exit(1);
}

const lectureData = JSON.parse(readFileSync(dataPath, 'utf-8'));
const scene = lectureData.sequence.find((s) => s.scene_id === sceneId);

if (!scene) {
  console.error(`❌ 씬 ${sceneId}을(를) 찾을 수 없습니다.`);
  console.log(`사용 가능한 씬: ${lectureData.sequence.map((s) => s.scene_id).join(', ')}`);
  process.exit(1);
}

let componentName;
let componentProps;

if (scene.visual.type === 'screenshot') {
  // 옵션A: 캡처된 실제 이미지를 ImageScreen으로 표시
  const screenshotPath = join(ROOT, 'packages/remotion/public/screenshots', lectureData.lecture_id, `scene-${sceneId}.png`);
  if (!existsSync(screenshotPath)) {
    console.error(`❌ 스크린샷 파일이 없습니다: ${screenshotPath}`);
    console.error(`먼저 아래 명령어로 캡처를 실행해주세요:`);
    console.error(`  make capture-screenshots LECTURE=${lectureFile}`);
    process.exit(1);
  }
  componentName = 'ImageScreen';
  componentProps = {
    src: `screenshots/${lectureData.lecture_id}/scene-${sceneId}.png`,
    url: scene.visual.url,
    title: scene.visual.title,
    description: scene.visual.description,
    layout: scene.visual.layout || 'right',
  };
} else {
  componentName = scene.visual.component || 'DefaultScreen';
  componentProps = scene.visual.props || {};
}

console.log(`📸 프리뷰 생성 중...`);
console.log(`   씬: ${sceneId} (${componentName})`);
console.log(`   프레임: ${frameNum}`);
console.log(`   Props: ${JSON.stringify(componentProps).substring(0, 100)}...`);

// 출력 디렉토리 — 강의별 하위 폴더로 구분
const outputDir = join(ROOT, 'output', 'preview', lectureData.lecture_id);
if (!existsSync(outputDir)) {
  mkdirSync(outputDir, { recursive: true });
}

const outputPath = join(outputDir, `scene-${sceneId}-${componentName}-f${frameNum}.png`);

// remotion still 실행
const inputProps = JSON.stringify({ componentName, props: componentProps });
const cmd = [
  'npx remotion still',
  'src/Root.tsx',
  'Preview',
  `"${outputPath}"`,
  `--frame=${frameNum}`,
  `--props='${inputProps}'`,
].join(' ');

try {
  execSync(cmd, {
    cwd: join(ROOT, 'packages/remotion'),
    stdio: 'inherit',
    timeout: 60000,
  });
  console.log(`\n✅ 프리뷰 저장 완료: ${outputPath}`);

  // macOS에서 자동으로 이미지 열기
  if (process.platform === 'darwin') {
    execSync(`open "${outputPath}"`);
  }
} catch (err) {
  console.error(`\n❌ 프리뷰 생성 실패`);
  process.exit(1);
}
