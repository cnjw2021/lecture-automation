import { Lecture } from '../../domain/entities/Lecture';
import { IClipRepository } from '../../domain/interfaces/IClipRepository';
import { ISceneClipRenderProvider } from '../../domain/interfaces/ISceneClipRenderProvider';
import { ILectureRepository } from '../../domain/interfaces/ILectureRepository';

export interface RenderSceneClipsOptions {
  force?: boolean;
  scenes?: number[];
}

export class RenderSceneClipsUseCase {
  constructor(
    private readonly sceneClipRenderProvider: ISceneClipRenderProvider,
    private readonly clipRepository: IClipRepository,
    private readonly lectureRepository: ILectureRepository
  ) {}

  async execute(lecture: Lecture, options: RenderSceneClipsOptions = {}): Promise<void> {
    const startTime = Date.now();

    const targetScenes = options.scenes
      ? lecture.sequence.filter(s => options.scenes!.includes(s.scene_id))
      : lecture.sequence;

    console.log(`\n🎬 씬 클립 렌더링 시작 (대상: ${targetScenes.length}개 씬)`);

    const audioDurations = await this.lectureRepository.getAudioDurations(lecture.lecture_id);
    if (!audioDurations) {
      throw new Error('durations.json을 찾을 수 없습니다. 먼저 오디오를 생성해 주세요.');
    }

    let rendered = 0;
    let skipped = 0;

    for (const scene of targetScenes) {
      const exists = await this.clipRepository.existsClip(lecture.lecture_id, scene.scene_id);
      if (exists && !options.force) {
        console.log(`  ⏭️  Scene ${scene.scene_id} — 클립 존재, 스킵`);
        skipped++;
        continue;
      }

      console.log(`  🎞️  Scene ${scene.scene_id} 렌더링 중...`);
      const outPath = this.clipRepository.getClipPath(lecture.lecture_id, scene.scene_id);
      await this.sceneClipRenderProvider.renderScene(
        lecture.lecture_id,
        scene.scene_id,
        outPath,
        lecture,
        audioDurations
      );
      rendered++;
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`✅ 씬 클립 렌더링 완료 — 렌더: ${rendered}개, 스킵: ${skipped}개 (${elapsed}초)`);
  }
}
