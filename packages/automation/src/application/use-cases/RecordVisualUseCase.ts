import { Lecture } from '../../domain/entities/Lecture';
import { IVisualProvider } from '../../domain/interfaces/IVisualProvider';
import { ILectureRepository } from '../../domain/interfaces/ILectureRepository';

export interface RecordVisualUseCaseOptions {
  force?: boolean;
}

export class RecordVisualUseCase {
  constructor(
    private readonly visualProvider: IVisualProvider,
    private readonly lectureRepository: ILectureRepository
  ) {}

  async execute(lecture: Lecture, options: RecordVisualUseCaseOptions = {}): Promise<void> {
    const { force = false } = options;
    console.log(`[${lecture.lecture_id}] 시각 자료 녹화 공정 시작 (Provider: ${this.visualProvider.constructor.name})`);

    for (const scene of lecture.sequence) {
      if (scene.visual.type !== 'playwright') continue;

      const outputPath = this.lectureRepository.getCapturePath(lecture.lecture_id, scene.scene_id);
      
      if (!force && await this.lectureRepository.existsCapture(lecture.lecture_id, scene.scene_id)) {
        console.log(`- Scene ${scene.scene_id} 영상 이미 존재함 (스킵)`);
        continue;
      }

      try {
        await this.visualProvider.record(scene, outputPath);
      } catch (error: any) {
        console.error(`- Scene ${scene.scene_id} 녹화 실패:`, error.message);
      }
    }
  }
}
