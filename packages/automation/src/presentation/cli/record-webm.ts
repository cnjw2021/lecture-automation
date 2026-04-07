/**
 * CLI: 특정 Playwright 씬의 raw video(webm)만 개별 녹화
 * 사용법: npx tsx record-webm.ts <lecture.json> <sceneId> [sceneId2 ...]
 * 예시:   npx tsx record-webm.ts lecture-03.json 17
 *         npx tsx record-webm.ts lecture-03.json 17 18 19
 */
import * as fs from 'fs-extra';
import * as path from 'path';
import { Lecture } from '../../domain/entities/Lecture';
import { RecordVisualUseCase } from '../../application/use-cases/RecordVisualUseCase';
import { ValidateLectureUseCase } from '../../application/use-cases/ValidateLectureUseCase';
import { config } from '../../infrastructure/config';
import { PlaywrightVisualProvider } from '../../infrastructure/providers/PlaywrightVisualProvider';
import { FileLectureRepository } from '../../infrastructure/repositories/FileLectureRepository';

async function runRecordWebm(jsonFileName: string, sceneIds: number[]) {
  console.log(`🎥 Playwright webm 녹화: ${jsonFileName} / Scene ${sceneIds.join(', ')}`);

  const filePath = path.join(config.paths.data, jsonFileName);
  if (!await fs.pathExists(filePath)) {
    console.error(`❌ 파일을 찾을 수 없습니다: ${filePath}`);
    process.exit(1);
  }

  const lectureData: Lecture = JSON.parse(await fs.readFile(filePath, 'utf8'));

  const validateLectureUseCase = new ValidateLectureUseCase();
  validateLectureUseCase.execute(lectureData);

  const invalidScenes = sceneIds.filter(id => !lectureData.sequence.some(scene => scene.scene_id === id));
  if (invalidScenes.length > 0) {
    console.error(`❌ 존재하지 않는 씬 ID: ${invalidScenes.join(', ')}`);
    process.exit(1);
  }

  const nonPlaywrightScenes = sceneIds.filter(id => {
    const scene = lectureData.sequence.find(candidate => candidate.scene_id === id);
    return scene?.visual.type !== 'playwright';
  });
  if (nonPlaywrightScenes.length > 0) {
    console.error(`❌ webm 녹화는 playwright 씬만 지원합니다: ${nonPlaywrightScenes.join(', ')}`);
    process.exit(1);
  }

  const filteredLecture: Lecture = {
    ...lectureData,
    sequence: lectureData.sequence.filter(scene => sceneIds.includes(scene.scene_id)),
  };

  const lectureRepository = new FileLectureRepository();
  const visualProvider = new PlaywrightVisualProvider();
  const recordVisualUseCase = new RecordVisualUseCase(visualProvider, lectureRepository);

  await recordVisualUseCase.execute(filteredLecture, { force: true, useSynthCapture: false });

  console.log('\n✅ webm 생성 완료');
  for (const sceneId of sceneIds) {
    const outputPath = lectureRepository.getCapturePath(lectureData.lecture_id, sceneId);
    console.log(`   - Scene ${sceneId}: ${outputPath}`);
  }
}

if (require.main === module) {
  const [, , jsonFileName, ...sceneArgs] = process.argv;
  if (!jsonFileName || sceneArgs.length === 0) {
    console.error('사용법: npx tsx record-webm.ts <lecture.json> <sceneId> [sceneId2 ...]');
    process.exit(1);
  }

  const sceneIds = sceneArgs.map(Number);
  if (sceneIds.some(Number.isNaN)) {
    console.error('❌ sceneId는 숫자여야 합니다.');
    process.exit(1);
  }

  runRecordWebm(jsonFileName, sceneIds).catch(error => {
    console.error(error);
    process.exit(1);
  });
}
