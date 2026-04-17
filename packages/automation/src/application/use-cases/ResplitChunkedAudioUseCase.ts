import * as fs from 'fs-extra';
import * as path from 'path';
import { Lecture } from '../../domain/entities/Lecture';
import { AudioAlignment, AudioConfig } from '../../domain/interfaces/IAudioProvider';
import { ILectureRepository } from '../../domain/interfaces/ILectureRepository';
import { BoundaryDiagnostic, BoundaryOverride, splitChunkAudio } from '../../domain/services/ChunkAudioSplitter';
import { SceneNarrationSegment } from '../../domain/services/NarrationChunker';
import { config } from '../../infrastructure/config';

interface ChunkManifest {
  lectureId: string;
  chunkIndex: number;
  totalChunks: number;
  generatedAt: string;
  text: string;
  textLength: number;
  sceneIds: number[];
  segments: SceneNarrationSegment[];
}

export interface ResplitChunkedAudioUseCaseOptions {
  sceneIds?: number[];
}

export interface ResplitChunkResult {
  chunkIndex: number;
  sceneIds: number[];
  detectedBoundaries: BoundaryDiagnostic[];
}

export interface ResplitChunkedAudioUseCaseResult {
  lectureId: string;
  debugDir: string;
  affectedChunks: ResplitChunkResult[];
  savedSceneIds: number[];
}

export class ResplitChunkedAudioUseCase {
  private readonly chunkDebugBaseDir = path.join(config.paths.root, 'tmp', 'chunked-audio');
  private readonly boundaryOverridesFileName = 'boundary-overrides.json';

  constructor(
    private readonly lectureRepository: ILectureRepository,
    private readonly audioConfig: AudioConfig,
  ) {}

  async execute(
    lecture: Lecture,
    options: ResplitChunkedAudioUseCaseOptions = {},
  ): Promise<ResplitChunkedAudioUseCaseResult> {
    const debugDir = path.join(this.chunkDebugBaseDir, lecture.lecture_id);
    if (!await fs.pathExists(debugDir)) {
      throw new Error(`청크 디버그 산출물이 없습니다: ${debugDir}`);
    }

    const manifestFiles = (await fs.readdir(debugDir))
      .filter(name => name.endsWith('.manifest.json'))
      .sort();

    if (manifestFiles.length === 0) {
      throw new Error(`청크 manifest를 찾을 수 없습니다: ${debugDir}`);
    }

    const targetSceneIds = new Set(options.sceneIds ?? []);
    const durations = (await this.lectureRepository.getAudioDurations(lecture.lecture_id)) ?? {};
    const affectedChunks: ResplitChunkResult[] = [];
    const savedSceneIds = new Set<number>();
    const coveredTargetSceneIds = new Set<number>();
    const boundaryOverrides = await this.loadBoundaryOverrides(debugDir);

    for (const fileName of manifestFiles) {
      const manifestPath = path.join(debugDir, fileName);
      const manifest = await fs.readJson(manifestPath) as ChunkManifest;
      const shouldProcess = targetSceneIds.size === 0
        || manifest.sceneIds.some(sceneId => targetSceneIds.has(sceneId));

      if (!shouldProcess) {
        continue;
      }

      const chunkPrefix = manifestPath.slice(0, -'.manifest.json'.length);
      const wavPath = `${chunkPrefix}.wav`;
      const alignmentPath = `${chunkPrefix}.alignment.json`;
      if (!await fs.pathExists(wavPath) || !await fs.pathExists(alignmentPath)) {
        throw new Error(`청크 원본 WAV/alignment가 누락되었습니다: ${chunkPrefix}`);
      }

      const wavBuffer = await fs.readFile(wavPath);
      const alignment = await fs.readJson(alignmentPath) as AudioAlignment;
      const splitResult = splitChunkAudio(wavBuffer, alignment, manifest.segments, this.audioConfig, {
        boundaryOverrides,
      });
      const sceneSegments = splitResult.scenes;
      await fs.writeJson(`${chunkPrefix}.boundaries.json`, splitResult.boundaries, { spaces: 2 });

      for (const sceneSeg of sceneSegments) {
        await this.lectureRepository.saveAudio(lecture.lecture_id, sceneSeg.sceneId, sceneSeg.buffer);
        await this.lectureRepository.saveAlignment(lecture.lecture_id, sceneSeg.sceneId, sceneSeg.alignment);
        durations[sceneSeg.sceneId] = sceneSeg.durationSec;
        savedSceneIds.add(sceneSeg.sceneId);
      }

      for (const sceneId of manifest.sceneIds) {
        if (targetSceneIds.has(sceneId)) {
          coveredTargetSceneIds.add(sceneId);
        }
      }

      affectedChunks.push({
        chunkIndex: manifest.chunkIndex,
        sceneIds: manifest.sceneIds,
        detectedBoundaries: splitResult.boundaries.filter(boundary => boundary.appliedOffsetMs !== 0 || boundary.usedOverride || boundary.reasons.length > 0),
      });
    }

    if (targetSceneIds.size > 0) {
      const missingSceneIds = [...targetSceneIds].filter(sceneId => !coveredTargetSceneIds.has(sceneId));
      if (missingSceneIds.length > 0) {
        throw new Error(
          `지정한 씬이 청크 디버그 산출물에 없습니다: ${missingSceneIds.join(', ')}. ` +
          `해당 강의를 청크 모드로 한 번 생성했는지 확인하세요.`,
        );
      }
    }

    if (affectedChunks.length === 0) {
      throw new Error('재분할할 청크를 찾지 못했습니다.');
    }

    await this.lectureRepository.saveAudioDurations(lecture.lecture_id, durations);

    return {
      lectureId: lecture.lecture_id,
      debugDir,
      affectedChunks,
      savedSceneIds: [...savedSceneIds].sort((a, b) => a - b),
    };
  }

  private async loadBoundaryOverrides(debugDir: string): Promise<BoundaryOverride[]> {
    const overridePath = path.join(debugDir, this.boundaryOverridesFileName);
    if (!await fs.pathExists(overridePath)) {
      return [];
    }

    const raw = await fs.readJson(overridePath) as unknown;
    if (!Array.isArray(raw)) {
      throw new Error(`boundary-overrides.json 형식이 올바르지 않습니다: ${overridePath}`);
    }

    return raw.filter((item): item is BoundaryOverride => (
      item !== null
      && typeof item === 'object'
      && Number.isInteger((item as BoundaryOverride).fromSceneId)
      && Number.isInteger((item as BoundaryOverride).toSceneId)
      && typeof (item as BoundaryOverride).offsetMs === 'number'
    ));
  }
}
