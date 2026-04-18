import { Lecture, Scene } from '../../domain/entities/Lecture';
import { INarrationAudioPreparationService } from '../../domain/interfaces/INarrationAudioPreparationService';
import {
  isForwardSyncTarget,
  isIsolatedLiveDemoScene,
  isSharedSessionScene,
} from '../../domain/policies/LiveDemoScenePolicy';
import { CaptureScreenshotUseCase } from './CaptureScreenshotUseCase';
import { CaptureSharedLiveDemoSessionsUseCase } from './CaptureSharedLiveDemoSessionsUseCase';
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
  ttsOnly: boolean;
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
    private readonly captureSharedLiveDemoSessionsUseCase: CaptureSharedLiveDemoSessionsUseCase,
    private readonly renderSceneClipsUseCase: RenderSceneClipsUseCase,
    private readonly concatClipsUseCase: ConcatClipsUseCase,
  ) {}

  async execute(options: RunAutomationPipelineOptions): Promise<{ outputPath: string; lecture: Lecture }> {
    this.validateLectureUseCase.execute(options.lecture);

    let lecture = options.lecture;
    const targetSceneIds = options.targetSceneIds;

    // 0단계: isolated 라이브 데모 씬 사전 녹화 — TTS보다 먼저 실행
    if (this.hasAnyScene(lecture, isIsolatedLiveDemoScene, targetSceneIds)) {
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
    await this.mergeAudioUseCase.execute(lecture, options.ttsOnly ? targetSceneIds : undefined);

    if (options.ttsOnly) {
      console.log('\n✅ [TTS_ONLY] TTS 생성 + 미리 듣기 머지 완료. 이후 단계를 건너뜁니다.');
      return { outputPath: '', lecture };
    }

    // 1.7a단계: isolated 라이브 데모 씬 역방향 싱크 (비디오에 오디오를 맞춤)
    if (this.hasAnyScene(lecture, isIsolatedLiveDemoScene, targetSceneIds)) {
      console.log('\n--- 1.7a단계: 라이브 데모 씬 역방향 싱크 ---');
      const { adjustedSceneIds } = await this.reverseSyncPlaywrightUseCase.execute(lecture, {
        sceneIds: targetSceneIds,
      });
      if (adjustedSceneIds.length > 0) {
        console.log(`  ✅ 씬 ${adjustedSceneIds.join(', ')} 오디오 역방향 싱크 완료`);
      }
    }

    // 1.7b단계: Playwright 씬 순방향 싱크 (오디오에 비디오를 맞춤)
    if (this.hasAnyScene(lecture, isForwardSyncTarget, targetSceneIds)) {
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

    // 3a단계: shared 라이브 데모 세션 캡처 (P-D)
    if (this.hasAnyScene(lecture, isSharedSessionScene, targetSceneIds)) {
      console.log('\n--- 3a단계: shared 라이브 데모 세션 캡처 ---');
      await this.captureSharedLiveDemoSessionsUseCase.execute(lecture, {
        force: options.forceRegenerate,
        sceneIds: targetSceneIds,
      });
    }

    console.log('\n--- 4단계: 씬별 클립 렌더링 ---');
    await this.renderSceneClipsUseCase.execute(lecture, {
      force: options.forceRegenerate,
      scenes: targetSceneIds,
    });

    console.log('\n--- 5단계: 클립 이어붙이기 ---');
    const outputPath = await this.concatClipsUseCase.execute(lecture);
    return { outputPath, lecture };
  }

  /** 대상 씬 범위 내에서 predicate 를 만족하는 씬이 하나라도 있는지 */
  private hasAnyScene(
    lecture: Lecture,
    predicate: (scene: Scene) => boolean,
    targetSceneIds?: number[],
  ): boolean {
    return lecture.sequence.some(scene => {
      if (targetSceneIds && !targetSceneIds.includes(scene.scene_id)) return false;
      return predicate(scene);
    });
  }
}
