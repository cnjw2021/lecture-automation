import * as fs from 'fs-extra';
import * as path from 'path';
import { GenerateAudioUseCase } from '../../application/use-cases/GenerateAudioUseCase';
import { ImportMasterAudioUseCase } from '../../application/use-cases/ImportMasterAudioUseCase';
import { Lecture } from '../../domain/entities/Lecture';
import { IAudioProviderFactory } from '../../domain/interfaces/IAudioProviderFactory';
import { IAudioSegmentProvider } from '../../domain/interfaces/IAudioSegmentProvider';
import { ILectureRepository } from '../../domain/interfaces/ILectureRepository';
import { IMasterAudioAlignmentProvider } from '../../domain/interfaces/IMasterAudioAlignmentProvider';
import {
  INarrationAudioPreparationService,
  NarrationAudioPreparationParams,
  NarrationAudioPreparationResult,
} from '../../domain/interfaces/INarrationAudioPreparationService';
import { config } from '../config';
import { printAlignmentFailureHints, resolveAlignmentPythonCommand } from '../providers/PythonMasterAudioAlignmentProvider';
import { resolveAlignmentModel, resolveAlignmentPath, resolveMasterAudioPath } from '../config/masterAudioPaths';

async function getFileMtimeMs(targetPath: string): Promise<number | null> {
  if (!await fs.pathExists(targetPath)) {
    return null;
  }
  const stats = await fs.stat(targetPath);
  return stats.mtimeMs;
}

async function hasImportedMasterAudioAssets(lecture: Lecture, lectureRepository: ILectureRepository): Promise<boolean> {
  const durationsPath = path.join(config.paths.audio, lecture.lecture_id, 'durations.json');
  if (!await fs.pathExists(durationsPath)) {
    return false;
  }

  for (const scene of lecture.sequence) {
    if (!await lectureRepository.existsAudio(lecture.lecture_id, scene.scene_id)) {
      return false;
    }
  }

  return true;
}

async function shouldImportMasterAudio(
  lecture: Lecture,
  lectureRepository: ILectureRepository,
  masterAudioPath: string,
  alignmentPath: string,
): Promise<boolean> {
  const durationsPath = path.join(config.paths.audio, lecture.lecture_id, 'durations.json');
  const segmentsPath = path.join(config.paths.root, 'tmp', 'audio-segmentation', lecture.lecture_id, 'segments.json');
  const masterMtime = await getFileMtimeMs(masterAudioPath);
  const alignmentMtime = await getFileMtimeMs(alignmentPath);
  const baselineMtime = Math.max(masterMtime ?? 0, alignmentMtime ?? 0);

  if (!await hasImportedMasterAudioAssets(lecture, lectureRepository)) {
    return true;
  }
  if (!await fs.pathExists(segmentsPath)) {
    return true;
  }

  const durationsMtime = await getFileMtimeMs(durationsPath);
  if ((durationsMtime ?? 0) < baselineMtime) {
    return true;
  }

  for (const scene of lecture.sequence) {
    const audioPath = lectureRepository.getAudioPath(lecture.lecture_id, scene.scene_id);
    const audioMtime = await getFileMtimeMs(audioPath);
    if ((audioMtime ?? 0) < baselineMtime) {
      return true;
    }
  }

  return false;
}

export class ConfiguredNarrationAudioPreparationService implements INarrationAudioPreparationService {
  constructor(
    private readonly lectureRepository: ILectureRepository,
    private readonly audioProviderFactory: IAudioProviderFactory,
    private readonly masterAudioAlignmentProvider: IMasterAudioAlignmentProvider,
    private readonly audioSegmentProvider: IAudioSegmentProvider,
  ) {}

  async prepare(params: NarrationAudioPreparationParams): Promise<NarrationAudioPreparationResult> {
    const masterAudioPath = resolveMasterAudioPath(config.paths.root, params.jsonFileName);
    if (await fs.pathExists(masterAudioPath)) {
      await this.prepareFromMasterAudio(params, masterAudioPath);
      return { source: 'master-audio' };
    }

    const { provider, providerName } = this.audioProviderFactory.create();
    console.log(`🔊 오디오 프로바이더: ${providerName}`);
    console.log('\n--- 1단계: 나레이션 오디오 생성 ---');
    const generateAudioUseCase = new GenerateAudioUseCase(provider, this.lectureRepository);
    await generateAudioUseCase.execute(params.lecture, { force: params.forceRegenerate });
    return { source: 'tts', providerName };
  }

  private async prepareFromMasterAudio(params: NarrationAudioPreparationParams, masterAudioPath: string): Promise<void> {
    const alignmentPath = resolveAlignmentPath(config.paths.root, params.jsonFileName);
    const modelName = resolveAlignmentModel();
    const alignmentMtime = await getFileMtimeMs(alignmentPath);
    const masterMtime = await getFileMtimeMs(masterAudioPath);
    const shouldGenerateAlignment = params.forceRegenerate || !alignmentMtime || (masterMtime ?? 0) > alignmentMtime;

    console.log('\n--- 1단계: 마스터 오디오 자동 정렬/분할 ---');
    console.log(`🎙️ 마스터 오디오 감지: ${masterAudioPath}`);

    if (shouldGenerateAlignment) {
      console.log('🧭 alignment.json 생성 중...');
      console.log(`   - output: ${alignmentPath}`);
      console.log(`   - model : ${modelName}`);
      console.log(`   - python: ${resolveAlignmentPythonCommand()}`);
      try {
        await this.masterAudioAlignmentProvider.generateAlignment({
          lecturePath: params.lecturePath,
          masterAudioPath,
          outputPath: alignmentPath,
          modelName,
        });
      } catch (error) {
        printAlignmentFailureHints(error);
        throw error;
      }
    } else {
      console.log(`⏭️  alignment 재사용: ${alignmentPath}`);
    }

    const shouldImport = params.forceRegenerate || await shouldImportMasterAudio(
      params.lecture,
      this.lectureRepository,
      masterAudioPath,
      alignmentPath,
    );
    if (!shouldImport) {
      console.log('⏭️  씬별 WAV와 durations.json이 이미 최신 상태라 분할을 스킵합니다.');
      return;
    }

    const importMasterAudioUseCase = new ImportMasterAudioUseCase(this.audioSegmentProvider, this.lectureRepository);
    const scenes = await importMasterAudioUseCase.execute(params.lecture, masterAudioPath, { alignmentPath });
    console.log(`✅ 마스터 오디오 분할 완료 (${scenes.length}개 씬)`);
  }
}
