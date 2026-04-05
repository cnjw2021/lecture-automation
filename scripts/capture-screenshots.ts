/**
 * 스크린샷 자동 캡처 스크립트 (옵션A 테스트용)
 *
 * lecture JSON에서 type: "screenshot" 씬을 찾아 Playwright로 캡처합니다.
 * TTS·렌더링 없이 캡처 단계만 단독으로 실행합니다.
 *
 * 사용법:
 *   npx tsx scripts/capture-screenshots.ts [lecture.json]
 *   make capture-screenshots
 *   make capture-screenshots LECTURE=my-lecture.json
 */

import * as path from 'path';
import * as fs from 'fs-extra';
import { FileLectureRepository } from '../packages/automation/src/infrastructure/repositories/FileLectureRepository';
import { PlaywrightScreenshotProvider } from '../packages/automation/src/infrastructure/providers/PlaywrightScreenshotProvider';
import { CaptureScreenshotUseCase } from '../packages/automation/src/application/use-cases/CaptureScreenshotUseCase';
import { Lecture } from '../packages/automation/src/domain/entities/Lecture';

const ROOT = path.join(__dirname, '..');

async function run() {
  const lectureFile = process.argv[2] || 'sample-screenshot-test.json';
  const filePath = path.join(ROOT, 'data', lectureFile);

  if (!await fs.pathExists(filePath)) {
    console.error(`❌ 파일을 찾을 수 없습니다: ${filePath}`);
    process.exit(1);
  }

  const lectureData: Lecture = await fs.readJson(filePath);
  const screenshotScenes = lectureData.sequence.filter(s => s.visual.type === 'screenshot');

  if (screenshotScenes.length === 0) {
    console.log(`⚠️  '${lectureFile}'에 type: "screenshot" 씬이 없습니다.`);
    process.exit(0);
  }

  console.log(`🔍 강의: ${lectureData.lecture_id}`);
  console.log(`📷 캡처 대상: ${screenshotScenes.length}개 씬`);
  screenshotScenes.forEach(s => {
    const v = s.visual as any;
    console.log(`   - Scene ${s.scene_id}: ${v.url}`);
  });
  console.log('');

  const repository = new FileLectureRepository();
  const provider = new PlaywrightScreenshotProvider();
  const useCase = new CaptureScreenshotUseCase(provider, repository);

  const force = process.env.FORCE === '1';
  await useCase.execute(lectureData, { force });

  console.log('\n✅ 스크린샷 캡처 완료');
  console.log(`📁 저장 위치: packages/remotion/public/screenshots/${lectureData.lecture_id}/`);
}

run().catch((err) => {
  console.error('❌ 캡처 중 오류:', err);
  process.exit(1);
});
