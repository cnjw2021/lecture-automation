import { Lecture, ScreenshotVisual } from '../../domain/entities/Lecture';
import { ILectureRepository } from '../../domain/interfaces/ILectureRepository';
import { IScreenshotProvider } from '../../domain/interfaces/IScreenshotProvider';

export interface CaptureScreenshotUseCaseOptions {
  force?: boolean;
  scenes?: number[];
}

export class CaptureScreenshotUseCase {
  constructor(
    private readonly screenshotProvider: IScreenshotProvider,
    private readonly lectureRepository: ILectureRepository
  ) {}

  async execute(lecture: Lecture, options: CaptureScreenshotUseCaseOptions = {}): Promise<void> {
    const { force = false, scenes } = options;

    const screenshotScenes = lecture.sequence.filter(s =>
      s.visual.type === 'screenshot' && (!scenes || scenes.includes(s.scene_id))
    );
    if (screenshotScenes.length === 0) {
      console.log('  > 스크린샷 타입 씬 없음 (스킵)');
      return;
    }

    console.log(`[${lecture.lecture_id}] 스크린샷 캡처 시작 (${screenshotScenes.length}개 씬)`);

    for (const scene of screenshotScenes) {
      const visual = scene.visual as ScreenshotVisual;
      const outputPath = this.lectureRepository.getScreenshotPath(lecture.lecture_id, scene.scene_id);

      if (!force && await this.lectureRepository.existsScreenshot(lecture.lecture_id, scene.scene_id)) {
        console.log(`- Scene ${scene.scene_id} 스크린샷 이미 존재함 (스킵)`);
        continue;
      }

      try {
        console.log(`- Scene ${scene.scene_id} 스크린샷 캡처 중: ${visual.url}`);
        await this.screenshotProvider.capture(visual.url, outputPath, visual.waitMs ?? 2000);
      } catch (error: any) {
        console.error(`- Scene ${scene.scene_id} 스크린샷 캡처 실패:`, error.message);
      }
    }
  }
}
