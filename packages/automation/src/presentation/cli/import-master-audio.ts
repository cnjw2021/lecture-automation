/**
 * CLI: 강의 단위 TTS 마스터 오디오를 씬별 WAV로 분할
 * 사용법: node import-master-audio.js <lecture.json> <master-audio-path> <alignment.json>
 * 예시:   node import-master-audio.js lecture-03.json input/master-audio/lecture-03/master.wav tmp/audio-segmentation/lecture-03/alignment.json
 */
import * as fs from 'fs-extra';
import * as path from 'path';
import { Lecture } from '../../domain/entities/Lecture';
import { ImportMasterAudioUseCase } from '../../application/use-cases/ImportMasterAudioUseCase';
import { config } from '../../infrastructure/config';
import { FfmpegAudioSegmentProvider } from '../../infrastructure/providers/FfmpegAudioSegmentProvider';
import { FileLectureRepository } from '../../infrastructure/repositories/FileLectureRepository';

async function runImportMasterAudio(jsonFileName: string, masterAudioPath: string, alignmentPath: string) {
  console.log(`🎙️ 마스터 오디오 씬 분할: ${jsonFileName}`);
  console.log(`   - master: ${masterAudioPath}`);
  console.log(`   - align : ${alignmentPath}`);

  const lecturePath = path.join(config.paths.data, jsonFileName);
  if (!await fs.pathExists(lecturePath)) {
    console.error(`❌ 파일을 찾을 수 없습니다: ${lecturePath}`);
    process.exit(1);
  }

  const lectureData: Lecture = JSON.parse(await fs.readFile(lecturePath, 'utf8'));
  const lectureRepository = new FileLectureRepository();
  const audioSegmentProvider = new FfmpegAudioSegmentProvider();
  const importMasterAudioUseCase = new ImportMasterAudioUseCase(audioSegmentProvider, lectureRepository);

  const scenes = await importMasterAudioUseCase.execute(lectureData, masterAudioPath, { alignmentPath });

  console.log('\n✅ 씬별 오디오 생성 완료');
  for (const scene of scenes) {
    console.log(
      `   - Scene ${scene.sceneId}: ${(scene.adjustedStartMs / 1000).toFixed(3)}s ~ ${(scene.adjustedEndMs / 1000).toFixed(3)}s (${scene.method})`
    );
  }
  console.log(`\n💡 다음 단계: make render-scene LECTURE=${jsonFileName} SCENE='${scenes.map(scene => scene.sceneId).join(' ')}'`);
}

if (require.main === module) {
  const [, , jsonFileName, masterAudioPath, alignmentPath] = process.argv;
  if (!jsonFileName || !masterAudioPath || !alignmentPath) {
    console.error('사용법: node import-master-audio.js <lecture.json> <master-audio-path> <alignment.json>');
    process.exit(1);
  }

  runImportMasterAudio(jsonFileName, masterAudioPath, alignmentPath).catch(error => {
    console.error('\n❌ 마스터 오디오 분할 실패');
    console.error(error);
    process.exit(1);
  });
}
