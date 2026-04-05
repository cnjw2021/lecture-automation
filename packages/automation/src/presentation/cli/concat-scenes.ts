/**
 * CLI: 씬 클립들을 이어붙여 최종 MP4 생성
 * 사용법: node concat-scenes.js <lecture.json>
 * 예시:   node concat-scenes.js lecture-02.json
 */
import * as fs from 'fs-extra';
import * as path from 'path';
import { config } from '../../infrastructure/config';
import { FileClipRepository } from '../../infrastructure/repositories/FileClipRepository';
import { FfmpegConcatProvider } from '../../infrastructure/providers/FfmpegConcatProvider';
import { ConcatClipsUseCase } from '../../application/use-cases/ConcatClipsUseCase';
import { Lecture } from '../../domain/entities/Lecture';

async function runConcatScenes(jsonFileName: string) {
  console.log(`🔗 씬 클립 이어붙이기: ${jsonFileName}`);

  const clipRepository = new FileClipRepository();
  const concatProvider = new FfmpegConcatProvider();
  const concatClipsUseCase = new ConcatClipsUseCase(concatProvider, clipRepository);

  const filePath = path.join(config.paths.data, jsonFileName);
  if (!await fs.pathExists(filePath)) {
    console.error(`❌ 파일을 찾을 수 없습니다: ${filePath}`);
    process.exit(1);
  }

  const lectureData: Lecture = JSON.parse(await fs.readFile(filePath, 'utf8'));
  await concatClipsUseCase.execute(lectureData);
}

if (require.main === module) {
  const [, , jsonFileName] = process.argv;
  if (!jsonFileName) {
    console.error('사용법: node concat-scenes.js <lecture.json>');
    process.exit(1);
  }

  runConcatScenes(jsonFileName).catch(console.error);
}
