/**
 * CLI: 특정 씬의 클립만 개별 렌더링
 * 사용법: node render-scene.js <lecture.json> <sceneId> [sceneId2 ...]
 * 예시:   node render-scene.js lecture-02.json 35
 *         node render-scene.js lecture-02.json 33 34 35
 */
import * as fs from 'fs-extra';
import * as path from 'path';
import { config } from '../../infrastructure/config';
import { FileLectureRepository } from '../../infrastructure/repositories/FileLectureRepository';
import { FileClipRepository } from '../../infrastructure/repositories/FileClipRepository';
import { RemotionSceneClipRenderProvider } from '../../infrastructure/providers/RemotionSceneClipRenderProvider';
import { RenderSceneClipsUseCase } from '../../application/use-cases/RenderSceneClipsUseCase';
import { Lecture } from '../../domain/entities/Lecture';

async function runRenderScene(jsonFileName: string, sceneIds: number[]) {
  console.log(`🎞️  씬 클립 렌더링: ${jsonFileName} / Scene ${sceneIds.join(', ')}`);

  const lectureRepository = new FileLectureRepository();
  const clipRepository = new FileClipRepository();
  const sceneClipRenderProvider = new RemotionSceneClipRenderProvider();
  const renderSceneClipsUseCase = new RenderSceneClipsUseCase(sceneClipRenderProvider, clipRepository, lectureRepository);

  const filePath = path.join(config.paths.data, jsonFileName);
  if (!await fs.pathExists(filePath)) {
    console.error(`❌ 파일을 찾을 수 없습니다: ${filePath}`);
    process.exit(1);
  }

  const lectureData: Lecture = JSON.parse(await fs.readFile(filePath, 'utf8'));

  const invalidScenes = sceneIds.filter(id => !lectureData.sequence.some(s => s.scene_id === id));
  if (invalidScenes.length > 0) {
    console.error(`❌ 존재하지 않는 씬 ID: ${invalidScenes.join(', ')}`);
    process.exit(1);
  }

  await renderSceneClipsUseCase.execute(lectureData, { scenes: sceneIds, force: true });

  console.log('\n💡 concat을 실행하려면:');
  console.log(`   make concat-scenes LECTURE=${jsonFileName}`);
}

if (require.main === module) {
  const [, , jsonFileName, ...sceneArgs] = process.argv;
  if (!jsonFileName || sceneArgs.length === 0) {
    console.error('사용법: node render-scene.js <lecture.json> <sceneId> [sceneId2 ...]');
    process.exit(1);
  }

  const sceneIds = sceneArgs.map(Number);
  if (sceneIds.some(isNaN)) {
    console.error('❌ sceneId는 숫자여야 합니다.');
    process.exit(1);
  }

  runRenderScene(jsonFileName, sceneIds).catch(console.error);
}
