import * as fs from 'fs-extra';
import * as path from 'path';
import { Lecture } from '../../domain/entities/Lecture';
import { AudioAlignment, AudioConfig, IAudioProvider } from '../../domain/interfaces/IAudioProvider';
import { ILectureRepository } from '../../domain/interfaces/ILectureRepository';
import { BoundaryDiagnostic, BoundaryOverride, splitChunkAudio } from '../../domain/services/ChunkAudioSplitter';
import { groupScenesIntoChunks, NarrationChunk, SceneNarrationSegment } from '../../domain/services/NarrationChunker';
import { config } from '../../infrastructure/config';

export interface GenerateChunkedAudioUseCaseOptions {
  force?: boolean;
  /** 1-based chunk indices. 지정 시 해당 청크만 생성하고 나머지는 건드리지 않는다. */
  targetChunkIndices?: number[];
}

/**
 * 복수 씬의 나레이션을 청크 단위로 묶어 TTS API를 호출하고,
 * alignment 기반으로 씬별 WAV로 분할하여 저장한다.
 *
 * 씬 단위 호출 대비 API 호출 수가 줄어 음색 일관성이 향상된다.
 */
export class GenerateChunkedAudioUseCase {
  private readonly REQUEST_INTERVAL_MS = 7000;
  private readonly chunkDebugBaseDir = path.join(config.paths.root, 'tmp', 'chunked-audio');
  private readonly boundaryOverridesFileName = 'boundary-overrides.json';

  constructor(
    private readonly audioProvider: IAudioProvider,
    private readonly lectureRepository: ILectureRepository,
    private readonly audioConfig: AudioConfig,
    private readonly maxCharsPerChunk: number,
  ) {}

  async execute(lecture: Lecture, options: GenerateChunkedAudioUseCaseOptions = {}): Promise<void> {
    const { force = false, targetChunkIndices } = options;
    console.log(`[${lecture.lecture_id}] 청크 단위 오디오 생성 시작 (maxChars: ${this.maxCharsPerChunk})`);

    const chunks = groupScenesIntoChunks(lecture.sequence, this.maxCharsPerChunk);
    console.log(`  📦 ${lecture.sequence.length}개 씬 → ${chunks.length}개 청크로 그룹핑`);
    const boundaryOverrides = await this.loadBoundaryOverrides(lecture.lecture_id);

    const targetChunkSet = this.resolveTargetChunkSet(targetChunkIndices, chunks.length);
    const isTargeted = targetChunkSet !== null;
    if (isTargeted) {
      console.log(`  🎯 청크 제한 모드: ${[...targetChunkSet].sort((a, b) => a - b).join(', ')}번 청크만 생성`);
    }

    const durations: Record<string, number> = isTargeted
      ? { ...((await this.lectureRepository.getAudioDurations(lecture.lecture_id)) ?? {}) }
      : {};
    let lastRequestTime = 0;

    for (let chunkIdx = 0; chunkIdx < chunks.length; chunkIdx++) {
      const chunk = chunks[chunkIdx];
      const sceneIds = chunk.segments.map(s => s.sceneId);
      const chunkLabel = `청크 ${chunkIdx + 1}/${chunks.length} (씬 ${sceneIds.join(', ')})`;

      if (isTargeted && !targetChunkSet.has(chunkIdx + 1)) {
        continue;
      }

      const effectiveForce = force || isTargeted;
      const missingScenes = effectiveForce ? chunk.segments : await this.findMissingScenes(lecture.lecture_id, chunk);

      if (missingScenes.length === 0) {
        console.log(`  ⏭️  ${chunkLabel} — 모든 씬 오디오 존재 (스킵)`);
        for (const seg of chunk.segments) {
          const existing = await this.lectureRepository.getAudioDuration(lecture.lecture_id, seg.sceneId);
          if (existing) {
            durations[seg.sceneId] = existing;
          }
        }
        continue;
      }

      const isPartial = !effectiveForce && missingScenes.length < chunk.segments.length;
      if (isPartial) {
        const missingIds = missingScenes.map(s => s.sceneId).join(', ');
        console.log(`  ⚠️  ${chunkLabel} — 일부 씬 누락 (씬 ${missingIds}), 누락분만 저장`);
      }

      const elapsed = Date.now() - lastRequestTime;
      if (lastRequestTime > 0 && elapsed < this.REQUEST_INTERVAL_MS) {
        const waitMs = this.REQUEST_INTERVAL_MS - elapsed;
        console.log(`  ⏳ RPM 제한 대응 대기 (${(waitMs / 1000).toFixed(1)}초)...`);
        await this.sleep(waitMs);
      }

      console.log(`  🎙️ ${chunkLabel} — ${chunk.text.length}자 생성 중...`);
      lastRequestTime = Date.now();

      const { buffer, alignment } = await this.audioProvider.generate(chunk.text);

      if (!alignment) {
        throw new Error(
          `${chunkLabel}: TTS 프로바이더가 alignment를 반환하지 않았습니다. ` +
          `청크 단위 생성에는 문자 단위 타임스탬프(with-timestamps)를 지원하는 프로바이더가 필요합니다.`,
        );
      }

      const debugDir = await this.saveChunkDebugArtifacts(
        lecture.lecture_id,
        chunk,
        chunkIdx,
        chunks.length,
        buffer,
        alignment,
      );
      console.log(`    📝 디버그 저장: ${debugDir}`);

      if (chunk.segments.length === 1) {
        await this.saveSingleSceneChunk(lecture.lecture_id, chunk, buffer, alignment, durations);
      } else {
        await this.splitAndSaveChunk(
          lecture.lecture_id,
          chunk,
          chunkIdx,
          buffer,
          alignment,
          durations,
          isPartial,
          boundaryOverrides,
        );
      }
    }

    await this.lectureRepository.saveAudioDurations(lecture.lecture_id, durations);
    console.log(`[${lecture.lecture_id}] 청크 단위 오디오 생성 완료`);
  }

  private resolveTargetChunkSet(targetChunkIndices: number[] | undefined, totalChunks: number): Set<number> | null {
    if (!targetChunkIndices || targetChunkIndices.length === 0) {
      return null;
    }
    const invalid = targetChunkIndices.filter(idx => !Number.isInteger(idx) || idx < 1 || idx > totalChunks);
    if (invalid.length > 0) {
      throw new Error(
        `지정한 청크 번호가 범위를 벗어났습니다: ${invalid.join(', ')}. 총 청크 수는 ${totalChunks}개입니다 (1~${totalChunks}).`,
      );
    }
    return new Set(targetChunkIndices);
  }

  private async findMissingScenes(lectureId: string, chunk: NarrationChunk): Promise<SceneNarrationSegment[]> {
    const missing: SceneNarrationSegment[] = [];
    for (const seg of chunk.segments) {
      if (!await this.lectureRepository.existsAudio(lectureId, seg.sceneId)) {
        missing.push(seg);
      }
    }
    return missing;
  }

  /** 단일 씬 청크: 분할 없이 그대로 저장 */
  private async saveSingleSceneChunk(
    lectureId: string,
    chunk: NarrationChunk,
    buffer: Buffer,
    alignment: AudioAlignment,
    durations: Record<string, number>,
  ): Promise<void> {
    const seg = chunk.segments[0];
    const { sampleRate, channels, bitDepth } = this.audioConfig;
    const bytesPerSecond = sampleRate * channels * (bitDepth / 8);
    const durationSec = (buffer.length - 44) / bytesPerSecond;

    await this.lectureRepository.saveAudio(lectureId, seg.sceneId, buffer);
    await this.lectureRepository.saveAlignment(lectureId, seg.sceneId, alignment);
    durations[seg.sceneId] = durationSec;

    console.log(`    ✅ 씬 ${seg.sceneId}: ${durationSec.toFixed(2)}초`);
  }

  /** 복수 씬 청크: alignment 기반 분할 후 저장 (이미 존재하는 씬은 스킵) */
  private async splitAndSaveChunk(
    lectureId: string,
    chunk: NarrationChunk,
    chunkIdx: number,
    buffer: Buffer,
    alignment: AudioAlignment,
    durations: Record<string, number>,
    missingScenesOnly: boolean,
    boundaryOverrides: ReadonlyArray<BoundaryOverride>,
  ): Promise<void> {
    const splitResult = splitChunkAudio(buffer, alignment, chunk.segments, this.audioConfig, {
      boundaryOverrides,
    });
    const sceneSegments = splitResult.scenes;
    await this.saveChunkBoundaryDiagnostics(lectureId, chunkIdx, splitResult.boundaries);

    for (const sceneSeg of sceneSegments) {
      if (missingScenesOnly && await this.lectureRepository.existsAudio(lectureId, sceneSeg.sceneId)) {
        const existing = await this.lectureRepository.getAudioDuration(lectureId, sceneSeg.sceneId);
        if (existing) {
          durations[sceneSeg.sceneId] = existing;
        }
        console.log(`    ⏭️  씬 ${sceneSeg.sceneId}: 기존 WAV 유지 (덮어쓰기 방지)`);
        continue;
      }

      await this.lectureRepository.saveAudio(lectureId, sceneSeg.sceneId, sceneSeg.buffer);
      await this.lectureRepository.saveAlignment(lectureId, sceneSeg.sceneId, sceneSeg.alignment);
      durations[sceneSeg.sceneId] = sceneSeg.durationSec;

      console.log(`    ✅ 씬 ${sceneSeg.sceneId}: ${sceneSeg.durationSec.toFixed(2)}초`);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async saveChunkDebugArtifacts(
    lectureId: string,
    chunk: NarrationChunk,
    chunkIdx: number,
    totalChunks: number,
    buffer: Buffer,
    alignment: AudioAlignment,
  ): Promise<string> {
    const lectureDir = path.join(this.chunkDebugBaseDir, lectureId);
    await fs.ensureDir(lectureDir);

    const chunkNumber = String(chunkIdx + 1).padStart(3, '0');
    const chunkPrefix = path.join(lectureDir, `chunk-${chunkNumber}`);

    await fs.writeFile(`${chunkPrefix}.wav`, buffer);
    await fs.writeJson(`${chunkPrefix}.alignment.json`, alignment, { spaces: 2 });
    await fs.writeJson(`${chunkPrefix}.manifest.json`, {
      lectureId,
      chunkIndex: chunkIdx + 1,
      totalChunks,
      generatedAt: new Date().toISOString(),
      text: chunk.text,
      textLength: chunk.text.length,
      sceneIds: chunk.segments.map(segment => segment.sceneId),
      segments: chunk.segments.map(segment => ({
        sceneId: segment.sceneId,
        narration: segment.narration,
        startCharIndex: segment.startCharIndex,
        charCount: segment.charCount,
      })),
    }, { spaces: 2 });

    return lectureDir;
  }

  private async saveChunkBoundaryDiagnostics(
    lectureId: string,
    chunkIdx: number,
    boundaries: BoundaryDiagnostic[],
  ): Promise<void> {
    const lectureDir = path.join(this.chunkDebugBaseDir, lectureId);
    await fs.ensureDir(lectureDir);
    const chunkNumber = String(chunkIdx + 1).padStart(3, '0');
    await fs.writeJson(path.join(lectureDir, `chunk-${chunkNumber}.boundaries.json`), boundaries, { spaces: 2 });
  }

  private async loadBoundaryOverrides(lectureId: string): Promise<BoundaryOverride[]> {
    const overridePath = path.join(this.chunkDebugBaseDir, lectureId, this.boundaryOverridesFileName);
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
