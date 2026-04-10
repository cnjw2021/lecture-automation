import * as fs from 'fs-extra';
import * as path from 'path';
import { GenerateAudioUseCase } from '../../application/use-cases/GenerateAudioUseCase';
import { GenerateChunkedAudioUseCase } from '../../application/use-cases/GenerateChunkedAudioUseCase';
import { GenerateMasterAudioUseCase } from '../../application/use-cases/GenerateMasterAudioUseCase';
import { ImportMasterAudioUseCase } from '../../application/use-cases/ImportMasterAudioUseCase';
import { MasterAudioManifest } from '../../domain/entities/MasterAudioManifest';
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
import {
  buildMasterAudioScript,
  computeMasterAudioHash,
  isSameMasterAudioGenerator,
} from '../../domain/utils/MasterAudioUtils';
import { config } from '../config';
import { printAlignmentFailureHints, resolveAlignmentPythonCommand } from '../providers/PythonMasterAudioAlignmentProvider';
import {
  resolveNarrationAudioSource,
  resolveAlignmentModel,
  resolveAlignmentPath,
  resolveMasterAudioManifestPath,
  resolveMasterAudioPath,
  resolveMasterAudioScriptPath,
} from '../config/masterAudioPaths';

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
    private readonly generateMasterAudioUseCase: GenerateMasterAudioUseCase | null,
    private readonly masterAudioAlignmentProvider: IMasterAudioAlignmentProvider,
    private readonly audioSegmentProvider: IAudioSegmentProvider,
  ) {}

  async prepare(params: NarrationAudioPreparationParams): Promise<NarrationAudioPreparationResult> {
    const narrationSource = resolveNarrationAudioSource();
    if (narrationSource === 'master') {
      const masterAudioPath = await this.ensureMasterAudio(params);
      if (!masterAudioPath) {
        throw new Error(
          'master audio 사용이 요청되었지만 사용할 master.wav를 찾지 못했습니다. MASTER_AUDIO를 지정하거나 config/tts.json의 masterAudio 설정과 GEMINI_API_KEY를 확인하세요.',
        );
      }
      await this.prepareFromMasterAudio(params, masterAudioPath);
      return { source: 'master-audio' };
    }

    const { provider, providerName } = this.audioProviderFactory.create();
    console.log(`🔊 오디오 프로바이더: ${providerName}`);
    console.log('\n--- 1단계: 나레이션 오디오 생성 ---');

    const chunkedConfig = config.getChunkedGenerationConfig();
    if (chunkedConfig.enabled) {
      console.log(`📦 청크 단위 생성 모드 (최대 ${chunkedConfig.maxCharsPerChunk}자/청크)`);
      if (!params.forceRegenerate) {
        console.log(`   기존 씬 WAV가 있으면 스킵됩니다. 청크 모드로 재생성하려면 force 옵션을 사용하세요.`);
      }
      const videoConfig = config.getVideoConfig();
      const audioConfig = {
        sampleRate: videoConfig.audio.sampleRate,
        channels: videoConfig.audio.channels,
        bitDepth: videoConfig.audio.bitDepth,
        speechRate: 1,
      };
      const chunkedUseCase = new GenerateChunkedAudioUseCase(
        provider,
        this.lectureRepository,
        audioConfig,
        chunkedConfig.maxCharsPerChunk,
      );
      await chunkedUseCase.execute(params.lecture, { force: params.forceRegenerate });
    } else {
      const generateAudioUseCase = new GenerateAudioUseCase(provider, this.lectureRepository);
      await generateAudioUseCase.execute(params.lecture, { force: params.forceRegenerate });
    }

    return { source: 'tts', providerName };
  }

  private async ensureMasterAudio(params: NarrationAudioPreparationParams): Promise<string | null> {
    const masterAudioPath = resolveMasterAudioPath(config.paths.root, params.jsonFileName);
    const manualOverride = Boolean(process.env.MASTER_AUDIO?.trim());
    const masterAudioExists = await fs.pathExists(masterAudioPath);

    if (!manualOverride && this.generateMasterAudioUseCase) {
      const shouldGenerate = await this.shouldGenerateMasterAudio(params, masterAudioPath);
      if (shouldGenerate) {
        console.log('\n--- 0단계: 강의 JSON으로 마스터 오디오 생성 ---');
        console.log(`🎤 마스터 오디오 생성 대상: ${masterAudioPath}`);
        const manifest = await this.generateMasterAudioUseCase.execute(params.lecture, {
          jsonFileName: params.jsonFileName,
          outputPath: masterAudioPath,
          manifestPath: resolveMasterAudioManifestPath(masterAudioPath),
          scriptPath: resolveMasterAudioScriptPath(masterAudioPath),
        });
        console.log(`✅ 마스터 오디오 생성 완료 (${manifest.generator.modelName}, Voice: ${manifest.generator.voiceName})`);
      }
      return await fs.pathExists(masterAudioPath) ? masterAudioPath : null;
    }

    if (masterAudioExists) {
      return masterAudioPath;
    }

    return null;
  }

  private async shouldGenerateMasterAudio(
    params: NarrationAudioPreparationParams,
    masterAudioPath: string,
  ): Promise<boolean> {
    if (!this.generateMasterAudioUseCase) {
      return false;
    }
    if (params.forceRegenerate) {
      return true;
    }
    if (!await fs.pathExists(masterAudioPath)) {
      return true;
    }

    const manifestPath = resolveMasterAudioManifestPath(masterAudioPath);
    if (!await fs.pathExists(manifestPath)) {
      return true;
    }

    const currentScript = buildMasterAudioScript(params.lecture);
    const expectedScriptHash = computeMasterAudioHash(currentScript);
    const expectedGenerator = this.generateMasterAudioUseCase.getDescriptor();
    const actualManifest = await fs.readJson(manifestPath) as MasterAudioManifest;

    if (actualManifest.scriptHash !== expectedScriptHash) {
      return true;
    }
    if (!isSameMasterAudioGenerator(actualManifest.generator, expectedGenerator)) {
      return true;
    }

    return false;
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
