import { Lecture, Scene, PlaywrightSyncPoint } from '../../domain/entities/Lecture';
import { AudioAlignment, AudioConfig, IAudioProvider } from '../../domain/interfaces/IAudioProvider';
import { ILectureRepository } from '../../domain/interfaces/ILectureRepository';
import { INarrationChunker, NarrationChunk } from '../../domain/services/NarrationChunker';
import { assembleSceneAudio, AssembleSceneAudioOptions, WavChunkInput } from '../../domain/utils/WavChunkAssembler';

export interface GenerateAudioUseCaseOptions {
  force?: boolean;
  /**
   * 씬별 청크 인덱스 제한. 지정된 씬에서 해당 인덱스 청크 파일만 삭제 후 재생성한다.
   * 다른 청크는 기존 파일을 재사용하고, 씬 최종 wav 만 concat 으로 갱신한다.
   * 키는 scene_id, 값은 chunkIndex 배열. force 와 함께 쓰면 force 가 우선.
   */
  targetChunks?: Record<number, number[]>;
}

interface SceneGenerationResult {
  scene_id: number;
  status: 'success' | 'skipped';
  durationSec: number;
  chunks: number;
  regeneratedChunks: number[];
}

export class GenerateAudioUseCase {
  private readonly REQUEST_INTERVAL_MS = 7000; // RPM 10 제한 대응 (약 8.5 req/min)

  constructor(
    private readonly audioProvider: IAudioProvider,
    private readonly lectureRepository: ILectureRepository,
    private readonly narrationChunker: INarrationChunker,
    private readonly audioConfig: AudioConfig,
    private readonly assembleOptions: AssembleSceneAudioOptions = {},
  ) {}

  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async execute(lecture: Lecture, options: GenerateAudioUseCaseOptions = {}): Promise<SceneGenerationResult[]> {
    const { force = false, targetChunks } = options;
    console.log(`[${lecture.lecture_id}] 오디오 공정 시작 (Provider: ${this.audioProvider.constructor.name})`);

    const results: SceneGenerationResult[] = [];
    const durations: Record<string, number> = (await this.lectureRepository.getAudioDurations(lecture.lecture_id)) ?? {};
    let lastRequestTime = 0;

    for (const scene of lecture.sequence) {
      try {
        const sceneResult = await this.processScene(
          lecture.lecture_id,
          scene,
          {
            force,
            targetChunkIndices: targetChunks?.[scene.scene_id],
            onBeforeTtsCall: async () => {
              const elapsed = Date.now() - lastRequestTime;
              if (lastRequestTime > 0 && elapsed < this.REQUEST_INTERVAL_MS) {
                const waitMs = this.REQUEST_INTERVAL_MS - elapsed;
                console.log(`  ⏳ RPM 제한 대응 대기 (${(waitMs / 1000).toFixed(1)}초)...`);
                await this.sleep(waitMs);
              }
              lastRequestTime = Date.now();
            },
          },
        );
        if (sceneResult.status === 'success') {
          durations[scene.scene_id] = sceneResult.durationSec;
        }
        results.push(sceneResult);
      } catch (error) {
        console.error(`\n❌ [치명적 에러] Scene ${scene.scene_id} 생성 중 오류 발생.`);
        console.error('--- 상세 에러 정보 ---');
        console.dir(error, { depth: null });
        console.error('----------------------');
        throw error;
      }
    }

    await this.lectureRepository.saveAudioDurations(lecture.lecture_id, durations);
    console.log(`[${lecture.lecture_id}] 오디오 duration 메타데이터 저장 완료`);

    return results;
  }

  // ---------------------------------------------------------------------------
  // Private — scene 단위 처리
  // ---------------------------------------------------------------------------

  private async processScene(
    lectureId: string,
    scene: Scene,
    ctx: {
      force: boolean;
      targetChunkIndices?: number[];
      onBeforeTtsCall: () => Promise<void>;
    },
  ): Promise<SceneGenerationResult> {
    const syncPoints = this.getSceneSyncPoints(scene);
    const chunks = this.narrationChunker.chunk(scene.narration, syncPoints);

    // 기존 캐시 상태 파악
    const fullAudioExists = await this.lectureRepository.existsAudio(lectureId, scene.scene_id);
    const chunkExistence = await Promise.all(
      chunks.map(ch => this.lectureRepository.existsAudioChunk(lectureId, scene.scene_id, ch.index)),
    );

    // 특정 청크 타겟 지정 — 해당 청크만 삭제 후 재생성 대상으로 처리
    if (ctx.targetChunkIndices && ctx.targetChunkIndices.length > 0) {
      for (const idx of ctx.targetChunkIndices) {
        if (idx < 0 || idx >= chunks.length) {
          throw new Error(
            `Scene ${scene.scene_id}: chunk index ${idx} 가 범위를 벗어남 (총 ${chunks.length}개). ` +
            `syncPoints 기준으로 0 ~ ${chunks.length - 1} 사이여야 합니다.`
          );
        }
        await this.lectureRepository.deleteAudioChunk(lectureId, scene.scene_id, idx);
        chunkExistence[idx] = false;
      }
    }

    // 스킵 조건: force 가 아니고, 청크가 단일이며 최종 오디오가 존재
    //          OR 청크가 여러 개이지만 모든 청크 + 최종 오디오가 존재
    const allChunksExist = chunkExistence.every(v => v);
    const noTargetChunks = !ctx.targetChunkIndices || ctx.targetChunkIndices.length === 0;
    if (!ctx.force && fullAudioExists && allChunksExist && noTargetChunks) {
      console.log(`- Scene ${scene.scene_id} 이미 존재함 (청크 ${chunks.length}개 + 최종 wav, 스킵)`);
      const existingDuration = await this.lectureRepository.getAudioDuration(lectureId, scene.scene_id);
      return {
        scene_id: scene.scene_id,
        status: 'skipped',
        durationSec: existingDuration ?? 0,
        chunks: chunks.length,
        regeneratedChunks: [],
      };
    }

    // 과거 캐시(청크 미존재 + 최종 wav 존재) 도 스킵 (force 아닐 때).
    // 기존 파이프라인과 동일한 동작을 유지하기 위함.
    if (!ctx.force && fullAudioExists && !chunkExistence.some(v => v) && noTargetChunks) {
      console.log(`- Scene ${scene.scene_id} 레거시 씬 단위 wav 존재 (청크 미생성, 스킵)`);
      const existingDuration = await this.lectureRepository.getAudioDuration(lectureId, scene.scene_id);
      return {
        scene_id: scene.scene_id,
        status: 'skipped',
        durationSec: existingDuration ?? 0,
        chunks: chunks.length,
        regeneratedChunks: [],
      };
    }

    // 재생성할 청크 결정
    const chunksToGenerate = ctx.force
      ? chunks
      : chunks.filter((_, i) => !chunkExistence[i]);

    console.log(
      `\n🎧 Scene ${scene.scene_id} — 청크 ${chunks.length}개 ` +
      `(재생성 ${chunksToGenerate.length}개${ctx.force ? ' / force' : ''})`
    );

    // 청크 생성
    for (const chunk of chunksToGenerate) {
      await ctx.onBeforeTtsCall();
      await this.generateAndPersistChunk(lectureId, scene.scene_id, chunk, chunks.length);
    }

    // concat: 모든 청크를 읽어 assembleSceneAudio 로 병합
    const assembly = await this.assembleFromChunks(lectureId, scene.scene_id, chunks);

    await this.lectureRepository.saveAudio(lectureId, scene.scene_id, assembly.buffer);
    if (assembly.alignment) {
      await this.lectureRepository.saveAlignment(lectureId, scene.scene_id, assembly.alignment);
    }

    this.assertDurationSane(scene, chunks, assembly.durationSec);

    console.log(
      `  ✅ Scene ${scene.scene_id} 최종 wav 저장 완료 ` +
      `(${chunks.length} chunks → ${assembly.durationSec.toFixed(2)}초)`
    );

    return {
      scene_id: scene.scene_id,
      status: 'success',
      durationSec: assembly.durationSec,
      chunks: chunks.length,
      regeneratedChunks: chunksToGenerate.map(c => c.index),
    };
  }

  private getSceneSyncPoints(scene: Scene): PlaywrightSyncPoint[] | undefined {
    if (scene.visual.type !== 'playwright') return undefined;
    return scene.visual.syncPoints;
  }

  private async generateAndPersistChunk(
    lectureId: string,
    sceneId: number,
    chunk: NarrationChunk,
    totalChunks: number,
  ): Promise<void> {
    console.log(
      `  🔊 chunk ${chunk.index + 1}/${totalChunks} 생성 중 (${chunk.text.length}자)...`
    );
    const { buffer, alignment } = await this.audioProvider.generate(chunk.text, {
      scene_id: sceneId,
    });
    await this.lectureRepository.saveAudioChunk(lectureId, sceneId, chunk.index, buffer);
    if (alignment) {
      await this.lectureRepository.saveAudioChunkAlignment(lectureId, sceneId, chunk.index, alignment);
    }
  }

  private async assembleFromChunks(
    lectureId: string,
    sceneId: number,
    chunks: NarrationChunk[],
  ): Promise<{ buffer: Buffer; durationSec: number; alignment?: AudioAlignment }> {
    const inputs: WavChunkInput[] = [];
    for (const chunk of chunks) {
      const buffer = await this.lectureRepository.loadAudioChunk(lectureId, sceneId, chunk.index);
      if (!buffer) {
        throw new Error(
          `Scene ${sceneId}: chunk ${chunk.index} wav 누락 — assemble 불가. ` +
          `force 재생성 또는 해당 청크 재생성 필요.`
        );
      }
      const alignment = await this.lectureRepository.getAudioChunkAlignment(lectureId, sceneId, chunk.index);
      inputs.push({ buffer, alignment: alignment ?? undefined });
    }
    return assembleSceneAudio(inputs, this.audioConfig, this.assembleOptions);
  }

  /**
   * 청크 합성 결과 길이가 문자수 기반 추정치와 ±25% 범위를 크게 벗어나면 경고.
   * concat 이 소음 없이 이어졌는지의 간접 체크. 완전한 이상 감지는 아니다.
   */
  private assertDurationSane(scene: Scene, chunks: NarrationChunk[], actualDurationSec: number): void {
    const totalChars = chunks.reduce((sum, c) => sum + c.text.length, 0);
    if (totalChars === 0) return;
    // 1초 ≒ 5자 (일본어 나레이션 경험치)
    const estimated = totalChars / 5;
    const ratio = actualDurationSec / estimated;
    if (ratio < 0.5 || ratio > 1.8) {
      console.warn(
        `  ⚠️ Scene ${scene.scene_id} 길이 이상 신호: 추정 ${estimated.toFixed(1)}s, 실제 ${actualDurationSec.toFixed(1)}s (ratio=${ratio.toFixed(2)}). ` +
        `청크 concat 이나 warmup trim 에 문제가 있을 수 있음.`
      );
    }
  }
}
