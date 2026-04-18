import { Lecture } from '../../domain/entities/Lecture';
import { IVisualProvider } from '../../domain/interfaces/IVisualProvider';
import { IStateCaptureProvider } from '../../domain/interfaces/IStateCaptureProvider';
import { ILectureRepository } from '../../domain/interfaces/ILectureRepository';
import { computePreRecordingSceneIds, isSharedSessionScene } from '../../domain/policies/LiveDemoScenePolicy';
import * as path from 'path';
import * as fs from 'fs-extra';

export interface RecordVisualUseCaseOptions {
  force?: boolean;
  /** true이면 상태 합성형 캡처 모드 사용 (기본: false → 기존 raw video 모드) */
  useSynthCapture?: boolean;
  /** true이면 라이브 데모 씬(wait_for 포함)만 처리. false/미지정이면 라이브 데모 씬 제외. */
  filterLiveDemo?: boolean;
  scenes?: number[];
}

export class RecordVisualUseCase {
  constructor(
    private readonly visualProvider: IVisualProvider,
    private readonly lectureRepository: ILectureRepository,
    private readonly stateCaptureProvider?: IStateCaptureProvider
  ) {}

  async execute(lecture: Lecture, options: RecordVisualUseCaseOptions = {}): Promise<void> {
    const { force = false, useSynthCapture = false, filterLiveDemo, scenes } = options;
    const mode = useSynthCapture && this.stateCaptureProvider ? '상태 합성형' : 'raw video';
    console.log(`[${lecture.lecture_id}] 시각 자료 녹화 공정 시작 (모드: ${mode})`);

    // 사전 녹화 대상(isolated 라이브 데모 + urlFromScene 의존 체인)
    const liveDemoSceneIds = computePreRecordingSceneIds(lecture);

    for (const scene of lecture.sequence) {
      if (scene.visual.type !== 'playwright') continue;
      if (scenes && !scenes.includes(scene.scene_id)) continue;

      // shared 세션 씬은 CaptureSharedLiveDemoSessionsUseCase 가 전담 → 이 use case 에서는 항상 스킵
      if (isSharedSessionScene(scene)) continue;

      // 라이브 데모 씬 필터링 (filterLiveDemo가 명시된 경우에만)
      if (filterLiveDemo !== undefined) {
        const isLiveDemo = liveDemoSceneIds.has(scene.scene_id);
        if (filterLiveDemo && !isLiveDemo) continue;    // 라이브 데모만 처리
        if (!filterLiveDemo && isLiveDemo) continue;     // 라이브 데모 제외
      }

      if (useSynthCapture && this.stateCaptureProvider) {
        // 상태 합성형 모드
        const captureDir = this.getStateCaptureDir(lecture.lecture_id, scene.scene_id);
        const manifestPath = path.join(captureDir, 'manifest.json');

        if (!force && await fs.pathExists(manifestPath)) {
          console.log(`- Scene ${scene.scene_id} 합성 캡처 이미 존재함 (스킵)`);
          continue;
        }

        try {
          const manifest = await this.stateCaptureProvider.capture(scene, captureDir);
          if (manifest) {
            // lectureId를 매니페스트에 설정
            manifest.lectureId = lecture.lecture_id;
            await fs.writeJson(manifestPath, manifest, { spaces: 2 });
          }
        } catch (error: any) {
          console.error(`- Scene ${scene.scene_id} 합성 캡처 실패:`, error.message);
        }
      } else {
        // 기존 raw video 모드
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

  private getStateCaptureDir(lectureId: string, sceneId: number): string {
    // captures/{lectureId}/scene-{sceneId}.webm と同階層に state-captures/ を配置
    // captures/ のベースディレクトリから state-captures/ に切り替え
    const capturePath = this.lectureRepository.getCapturePath(lectureId, sceneId);
    const capturesDir = path.dirname(path.dirname(capturePath)); // captures/ ディレクトリ
    const publicDir = path.dirname(capturesDir); // packages/remotion/public/
    return path.join(publicDir, 'state-captures', lectureId, `scene-${sceneId}`);
  }
}
