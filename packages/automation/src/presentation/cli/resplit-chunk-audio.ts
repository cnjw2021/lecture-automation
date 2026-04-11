import * as fs from 'fs-extra';
import * as path from 'path';
import { ResplitChunkedAudioUseCase } from '../../application/use-cases/ResplitChunkedAudioUseCase';
import { Lecture } from '../../domain/entities/Lecture';
import { config } from '../../infrastructure/config';
import { FileLectureRepository } from '../../infrastructure/repositories/FileLectureRepository';

async function runResplitChunkAudio(jsonFileName: string, sceneIds: number[]) {
  const lecturePath = path.join(config.paths.data, jsonFileName);
  if (!await fs.pathExists(lecturePath)) {
    console.error(`❌ 파일을 찾을 수 없습니다: ${lecturePath}`);
    process.exit(1);
  }

  const lectureData: Lecture = JSON.parse(await fs.readFile(lecturePath, 'utf8'));
  const videoConfig = config.getVideoConfig();
  const audioConfig = {
    sampleRate: videoConfig.audio.sampleRate,
    channels: videoConfig.audio.channels,
    bitDepth: videoConfig.audio.bitDepth,
    speechRate: 1,
  };

  const useCase = new ResplitChunkedAudioUseCase(new FileLectureRepository(), audioConfig);
  const result = await useCase.execute(lectureData, { sceneIds });

  console.log(`✅ 청크 재분할 완료: ${result.lectureId}`);
  console.log(`   - debug: ${result.debugDir}`);
  console.log(
    `   - chunks: ${result.affectedChunks.map(chunk => `${chunk.chunkIndex}(${chunk.sceneIds[0]}-${chunk.sceneIds.at(-1)})`).join(', ')}`
  );
  console.log(`   - saved scenes: ${result.savedSceneIds.join(', ')}`);
}

if (require.main === module) {
  const [, , jsonFileName, ...sceneArgs] = process.argv;
  if (!jsonFileName) {
    console.error('사용법: node resplit-chunk-audio.js <lecture.json> [scene_id ...]');
    process.exit(1);
  }

  const sceneIds = sceneArgs
    .flatMap(arg => arg.split(/[,\s]+/))
    .map(value => value.trim())
    .filter(Boolean)
    .map(value => Number.parseInt(value, 10))
    .filter(value => Number.isInteger(value) && value > 0);

  runResplitChunkAudio(jsonFileName, sceneIds).catch(error => {
    console.error('\n❌ 청크 재분할 실패');
    console.error(error);
    process.exit(1);
  });
}
