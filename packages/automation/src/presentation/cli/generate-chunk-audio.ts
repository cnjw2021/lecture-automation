import * as fs from 'fs-extra';
import * as path from 'path';
import { GenerateChunkedAudioUseCase } from '../../application/use-cases/GenerateChunkedAudioUseCase';
import { Lecture } from '../../domain/entities/Lecture';
import { groupScenesIntoChunks } from '../../domain/services/NarrationChunker';
import { config } from '../../infrastructure/config';
import { ConfiguredAudioProviderFactory } from '../../infrastructure/factories/ConfiguredAudioProviderFactory';
import { ElevenLabsConfiguredAudioProviderBuilder } from '../../infrastructure/factories/ElevenLabsConfiguredAudioProviderBuilder';
import { GeminiCloudTtsConfiguredAudioProviderBuilder } from '../../infrastructure/factories/GeminiCloudTtsConfiguredAudioProviderBuilder';
import { GeminiConfiguredAudioProviderBuilder } from '../../infrastructure/factories/GeminiConfiguredAudioProviderBuilder';
import { GoogleCloudTtsConfiguredAudioProviderBuilder } from '../../infrastructure/factories/GoogleCloudTtsConfiguredAudioProviderBuilder';
import { FileLectureRepository } from '../../infrastructure/repositories/FileLectureRepository';

async function runGenerateChunkAudio(jsonFileName: string, chunkIndices: number[]) {
  const lecturePath = path.join(config.paths.data, jsonFileName);
  if (!await fs.pathExists(lecturePath)) {
    console.error(`❌ 파일을 찾을 수 없습니다: ${lecturePath}`);
    process.exit(1);
  }

  const lecture: Lecture = JSON.parse(await fs.readFile(lecturePath, 'utf8'));

  const chunkedConfig = config.getChunkedGenerationConfig();
  if (!chunkedConfig.enabled) {
    console.error('❌ 현재 activeProvider의 chunkedGeneration.enabled가 false입니다. config/tts.json을 확인하세요.');
    process.exit(1);
  }

  const chunks = groupScenesIntoChunks(lecture.sequence, chunkedConfig.maxCharsPerChunk);
  console.log(`📦 총 청크 수: ${chunks.length}`);
  chunks.forEach((chunk, idx) => {
    const sceneIds = chunk.segments.map(seg => seg.sceneId).join(', ');
    const marker = chunkIndices.includes(idx + 1) ? '🎯' : '  ';
    console.log(`  ${marker} 청크 ${idx + 1}: 씬 ${sceneIds} (${chunk.text.length}자)`);
  });

  const audioProviderFactory = new ConfiguredAudioProviderFactory([
    new GeminiConfiguredAudioProviderBuilder(),
    new GoogleCloudTtsConfiguredAudioProviderBuilder(),
    new GeminiCloudTtsConfiguredAudioProviderBuilder(),
    new ElevenLabsConfiguredAudioProviderBuilder(),
  ]);
  const { provider, providerName } = audioProviderFactory.create();
  console.log(`🔊 오디오 프로바이더: ${providerName}`);

  const videoConfig = config.getVideoConfig();
  const audioConfig = {
    sampleRate: videoConfig.audio.sampleRate,
    channels: videoConfig.audio.channels,
    bitDepth: videoConfig.audio.bitDepth,
    speechRate: 1,
  };

  const useCase = new GenerateChunkedAudioUseCase(
    provider,
    new FileLectureRepository(),
    audioConfig,
    chunkedConfig.maxCharsPerChunk,
  );

  await useCase.execute(lecture, { targetChunkIndices: chunkIndices });

  console.log(`✅ 청크 ${chunkIndices.join(', ')} TTS 생성 완료 — 씬/영상 합치기는 수행하지 않았습니다.`);
}

if (require.main === module) {
  const [, , jsonFileName, ...chunkArgs] = process.argv;
  if (!jsonFileName || chunkArgs.length === 0) {
    console.error('사용법: node generate-chunk-audio.js <lecture.json> <chunk_index> [chunk_index ...]');
    console.error('  chunk_index는 1부터 시작합니다.');
    process.exit(1);
  }

  const chunkIndices = chunkArgs
    .flatMap(arg => arg.split(/[,\s]+/))
    .map(value => value.trim())
    .filter(Boolean)
    .map(value => Number.parseInt(value, 10))
    .filter(value => Number.isInteger(value) && value > 0);

  if (chunkIndices.length === 0) {
    console.error('❌ 유효한 청크 번호를 지정하세요. 예: 1 또는 "1 2 3"');
    process.exit(1);
  }

  runGenerateChunkAudio(jsonFileName, chunkIndices).catch(error => {
    console.error('\n❌ 청크 TTS 생성 실패');
    console.error(error);
    process.exit(1);
  });
}
