import { Lecture, PlaywrightVisual } from '../../domain/entities/Lecture';
import { INarrationAudioPreparationService } from '../../domain/interfaces/INarrationAudioPreparationService';
import { CaptureScreenshotUseCase } from './CaptureScreenshotUseCase';
import { ConcatClipsUseCase } from './ConcatClipsUseCase';
import { MergeAudioUseCase } from './MergeAudioUseCase';
import { RecordVisualUseCase } from './RecordVisualUseCase';
import { RenderSceneClipsUseCase } from './RenderSceneClipsUseCase';
import { SyncPlaywrightUseCase } from './SyncPlaywrightUseCase';
import { ValidateLectureUseCase } from './ValidateLectureUseCase';

export interface RunAutomationPipelineOptions {
  lecture: Lecture;
  jsonFileName: string;
  lecturePath: string;
  forceRegenerate: boolean;
  useSynthCapture: boolean;
  persistLecture?: (lecture: Lecture) => Promise<void>;
}

export class RunAutomationPipelineUseCase {
  constructor(
    private readonly validateLectureUseCase: ValidateLectureUseCase,
    private readonly narrationAudioPreparationService: INarrationAudioPreparationService,
    private readonly mergeAudioUseCase: MergeAudioUseCase,
    private readonly syncPlaywrightUseCase: SyncPlaywrightUseCase,
    private readonly captureScreenshotUseCase: CaptureScreenshotUseCase,
    private readonly recordVisualUseCase: RecordVisualUseCase,
    private readonly renderSceneClipsUseCase: RenderSceneClipsUseCase,
    private readonly concatClipsUseCase: ConcatClipsUseCase,
  ) {}

  async execute(options: RunAutomationPipelineOptions): Promise<{ outputPath: string; lecture: Lecture }> {
    this.validateLectureUseCase.execute(options.lecture);

    let lecture = options.lecture;
    await this.narrationAudioPreparationService.prepare({
      lecture,
      jsonFileName: options.jsonFileName,
      lecturePath: options.lecturePath,
      forceRegenerate: options.forceRegenerate,
    });

    console.log('\n--- 1.5단계: 전체 오디오 미리 듣기 머지 ---');
    await this.mergeAudioUseCase.execute(lecture);

    if (this.hasSyncableScenes(lecture)) {
      console.log('\n--- 1.7단계: Playwright 씬 싱크 자동 보정 ---');
      const { updatedLecture, changedSceneIds } = await this.syncPlaywrightUseCase.execute(lecture);
      if (changedSceneIds.length > 0) {
        lecture = updatedLecture;
        if (options.persistLecture) {
          await options.persistLecture(lecture);
        }
        console.log(`  ✅ 씬 ${changedSceneIds.join(', ')} wait 보정 완료 → ${options.lecturePath}`);
      }
    }

    console.log('\n--- 2단계: 스크린샷 캡처 ---');
    await this.captureScreenshotUseCase.execute(lecture, { force: options.forceRegenerate });

    console.log('\n--- 3단계: 시각 자료(브라우저) 녹화 ---');
    await this.recordVisualUseCase.execute(lecture, {
      force: options.forceRegenerate,
      useSynthCapture: options.useSynthCapture,
    });

    console.log('\n--- 4단계: 씬별 클립 렌더링 ---');
    await this.renderSceneClipsUseCase.execute(lecture, { force: options.forceRegenerate });

    console.log('\n--- 5단계: 클립 이어붙이기 ---');
    const outputPath = await this.concatClipsUseCase.execute(lecture);
    return { outputPath, lecture };
  }

  private hasSyncableScenes(lecture: Lecture): boolean {
    return lecture.sequence.some(scene =>
      scene.visual.type === 'playwright' &&
      ((scene.visual as PlaywrightVisual).syncPoints?.length ?? 0) > 0
    );
  }
}
