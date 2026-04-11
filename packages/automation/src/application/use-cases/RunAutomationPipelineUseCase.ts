import { Lecture, PlaywrightVisual } from '../../domain/entities/Lecture';
import { INarrationAudioPreparationService } from '../../domain/interfaces/INarrationAudioPreparationService';
import { CaptureScreenshotUseCase } from './CaptureScreenshotUseCase';
import { ConcatClipsUseCase } from './ConcatClipsUseCase';
import { MergeAudioUseCase } from './MergeAudioUseCase';
import { RecordVisualUseCase } from './RecordVisualUseCase';
import { RenderSceneClipsUseCase } from './RenderSceneClipsUseCase';
import { ReverseSyncPlaywrightUseCase } from './ReverseSyncPlaywrightUseCase';
import { SyncPlaywrightUseCase } from './SyncPlaywrightUseCase';
import { ValidateLectureUseCase } from './ValidateLectureUseCase';

export interface RunAutomationPipelineOptions {
  lecture: Lecture;
  jsonFileName: string;
  lecturePath: string;
  forceRegenerate: boolean;
  useSynthCapture: boolean;
  targetSceneIds?: number[];
  persistLecture?: (lecture: Lecture) => Promise<void>;
}

export class RunAutomationPipelineUseCase {
  constructor(
    private readonly validateLectureUseCase: ValidateLectureUseCase,
    private readonly narrationAudioPreparationService: INarrationAudioPreparationService,
    private readonly mergeAudioUseCase: MergeAudioUseCase,
    private readonly syncPlaywrightUseCase: SyncPlaywrightUseCase,
    private readonly reverseSyncPlaywrightUseCase: ReverseSyncPlaywrightUseCase,
    private readonly captureScreenshotUseCase: CaptureScreenshotUseCase,
    private readonly recordVisualUseCase: RecordVisualUseCase,
    private readonly renderSceneClipsUseCase: RenderSceneClipsUseCase,
    private readonly concatClipsUseCase: ConcatClipsUseCase,
  ) {}

  async execute(options: RunAutomationPipelineOptions): Promise<{ outputPath: string; lecture: Lecture }> {
    this.validateLectureUseCase.execute(options.lecture);

    let lecture = options.lecture;
    const targetSceneIds = options.targetSceneIds;

    // 0단계: 라이브 데모 씬(wait_for 포함) 사전 녹화 — TTS보다 먼저 실행
    if (this.hasLiveDemoScenes(lecture, targetSceneIds)) {
      console.log('\n--- 0단계: 라이브 데모 씬 사전 녹화 ---');
      await this.recordVisualUseCase.execute(lecture, {
        force: options.forceRegenerate,
        useSynthCapture: options.useSynthCapture,
        filterLiveDemo: true,
        scenes: targetSceneIds,
      });
    }

    await this.narrationAudioPreparationService.prepare({
      lecture,
      jsonFileName: options.jsonFileName,
      lecturePath: options.lecturePath,
      forceRegenerate: options.forceRegenerate,
      targetSceneIds,
    });

    console.log('\n--- 1.5단계: 전체 오디오 미리 듣기 머지 ---');
    await this.mergeAudioUseCase.execute(lecture);

    // 1.7a단계: 라이브 데모 씬 역방향 싱크 (비디오에 오디오를 맞춤)
    if (this.hasLiveDemoScenes(lecture)) {
      console.log('\n--- 1.7a단계: 라이브 데모 씬 역방향 싱크 ---');
      const { adjustedSceneIds } = await this.reverseSyncPlaywrightUseCase.execute(lecture, {
        sceneIds: targetSceneIds,
      });
      if (adjustedSceneIds.length > 0) {
        console.log(`  ✅ 씬 ${adjustedSceneIds.join(', ')} 오디오 역방향 싱크 완료`);
      }
    }

    // 1.7b단계: 일반 Playwright 씬 순방향 싱크 (오디오에 비디오를 맞춤)
    if (this.hasForwardSyncableScenes(lecture, targetSceneIds)) {
      console.log('\n--- 1.7b단계: Playwright 씬 순방향 싱크 자동 보정 ---');
      const { updatedLecture, changedSceneIds } = await this.syncPlaywrightUseCase.execute(lecture, {
        sceneIds: targetSceneIds,
      });
      if (changedSceneIds.length > 0) {
        lecture = updatedLecture;
        if (options.persistLecture) {
          await options.persistLecture(lecture);
        }
        console.log(`  ✅ 씬 ${changedSceneIds.join(', ')} wait 보정 완료 → ${options.lecturePath}`);
      }
    }

    console.log('\n--- 2단계: 스크린샷 캡처 ---');
    await this.captureScreenshotUseCase.execute(lecture, {
      force: options.forceRegenerate,
      scenes: targetSceneIds,
    });

    console.log('\n--- 3단계: 시각 자료(브라우저) 녹화 ---');
    await this.recordVisualUseCase.execute(lecture, {
      force: options.forceRegenerate,
      useSynthCapture: options.useSynthCapture,
      filterLiveDemo: false,
      scenes: targetSceneIds,
    });

    console.log('\n--- 4단계: 씬별 클립 렌더링 ---');
    await this.renderSceneClipsUseCase.execute(lecture, {
      force: options.forceRegenerate,
      scenes: targetSceneIds,
    });

    console.log('\n--- 5단계: 클립 이어붙이기 ---');
    const outputPath = await this.concatClipsUseCase.execute(lecture);
    return { outputPath, lecture };
  }

  /** wait_for가 action에 있는 라이브 데모 씬이 있는지 */
  private hasLiveDemoScenes(lecture: Lecture, targetSceneIds?: number[]): boolean {
    return lecture.sequence.some(scene =>
      (!targetSceneIds || targetSceneIds.includes(scene.scene_id)) &&
      scene.visual.type === 'playwright' &&
      (scene.visual as PlaywrightVisual).action.some(a => a.cmd === 'wait_for')
    );
  }

  /** 순방향 싱크 대상: syncPoints가 있되 wait_for는 없는 일반 Playwright 씬 */
  private hasForwardSyncableScenes(lecture: Lecture, targetSceneIds?: number[]): boolean {
    return lecture.sequence.some(scene => {
      if (targetSceneIds && !targetSceneIds.includes(scene.scene_id)) return false;
      if (scene.visual.type !== 'playwright') return false;
      const visual = scene.visual as PlaywrightVisual;
      const hasSync = (visual.syncPoints?.length ?? 0) > 0;
      const hasWaitFor = visual.action.some(a => a.cmd === 'wait_for');
      return hasSync && !hasWaitFor;
    });
  }
}
