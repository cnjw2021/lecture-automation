import { Lecture } from '../../domain/entities/Lecture';
import { AudioConfig, IAudioProvider } from '../../domain/interfaces/IAudioProvider';
import { ILectureRepository } from '../../domain/interfaces/ILectureRepository';
import { splitChunkAudio } from '../../domain/services/ChunkAudioSplitter';
import { groupScenesIntoChunks, NarrationChunk, SceneNarrationSegment } from '../../domain/services/NarrationChunker';

export interface GenerateChunkedAudioUseCaseOptions {
  force?: boolean;
}

/**
 * 복수 씬의 나레이션을 청크 단위로 묶어 TTS API를 호출하고,
 * alignment 기반으로 씬별 WAV로 분할하여 저장한다.
 *
 * 씬 단위 호출 대비 API 호출 수가 줄어 음색 일관성이 향상된다.
 */
export class GenerateChunkedAudioUseCase {
  private readonly REQUEST_INTERVAL_MS = 7000;

  constructor(
    private readonly audioProvider: IAudioProvider,
    private readonly lectureRepository: ILectureRepository,
    private readonly audioConfig: AudioConfig,
    private readonly maxCharsPerChunk: number,
  ) {}

  async execute(lecture: Lecture, options: GenerateChunkedAudioUseCaseOptions = {}): Promise<void> {
    const { force = false } = options;
    console.log(`[${lecture.lecture_id}] 청크 단위 오디오 생성 시작 (maxChars: ${this.maxCharsPerChunk})`);

    const chunks = groupScenesIntoChunks(lecture.sequence, this.maxCharsPerChunk);
    console.log(`  📦 ${lecture.sequence.length}개 씬 → ${chunks.length}개 청크로 그룹핑`);

    const durations: Record<string, number> = {};
    let lastRequestTime = 0;

    for (let chunkIdx = 0; chunkIdx < chunks.length; chunkIdx++) {
      const chunk = chunks[chunkIdx];
      const sceneIds = chunk.segments.map(s => s.sceneId);
      const chunkLabel = `청크 ${chunkIdx + 1}/${chunks.length} (씬 ${sceneIds.join(', ')})`;

      const missingScenes = force ? chunk.segments : await this.findMissingScenes(lecture.lecture_id, chunk);

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

      const isPartial = !force && missingScenes.length < chunk.segments.length;
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

      if (chunk.segments.length === 1) {
        await this.saveSingleSceneChunk(lecture.lecture_id, chunk, buffer, alignment, durations);
      } else {
        await this.splitAndSaveChunk(lecture.lecture_id, chunk, buffer, alignment, durations, isPartial);
      }
    }

    await this.lectureRepository.saveAudioDurations(lecture.lecture_id, durations);
    console.log(`[${lecture.lecture_id}] 청크 단위 오디오 생성 완료`);
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
    alignment: import('../../domain/interfaces/IAudioProvider').AudioAlignment,
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
    buffer: Buffer,
    alignment: import('../../domain/interfaces/IAudioProvider').AudioAlignment,
    durations: Record<string, number>,
    missingScenesOnly: boolean,
  ): Promise<void> {
    const sceneSegments = splitChunkAudio(buffer, alignment, chunk.segments, this.audioConfig);

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
}
