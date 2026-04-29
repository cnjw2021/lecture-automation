import { Lecture, Scene } from '../../domain/entities/Lecture';
import { IVisualProvider } from '../../domain/interfaces/IVisualProvider';
import { IStateCaptureProvider } from '../../domain/interfaces/IStateCaptureProvider';
import { ILectureRepository } from '../../domain/interfaces/ILectureRepository';
import { IAudioDurationProbe } from '../../domain/interfaces/IAudioDurationProbe';
import { computePreRecordingSceneIds, isForwardSyncTarget, isSharedSessionScene } from '../../domain/policies/LiveDemoScenePolicy';
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

/**
 * #141 F-2: post-recording 검증 임계값.
 *
 * 순방향 싱크 씬은 sync-playwright 가 wait 액션을 audio 길이에 맞춰 재분배하므로
 * 정상 케이스에서 webm 과 audio 의 차이는 0~1초 범위. 1초 초과는 calibration 편향
 * 또는 sync-playwright 미실행을 의미.
 */
const DURATION_DIFF_WARN_MS = 500;
const DURATION_DIFF_ERROR_MS = 1000;

export class RecordVisualUseCase {
  constructor(
    private readonly visualProvider: IVisualProvider,
    private readonly lectureRepository: ILectureRepository,
    private readonly stateCaptureProvider?: IStateCaptureProvider,
    private readonly audioDurationProbe?: IAudioDurationProbe,
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
          const manifest = await this.stateCaptureProvider.capture(scene, captureDir, lecture.lecture_id);
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

        // 단일 씬 녹화 실패는 fail-fast — 부분 녹화 webm 으로 후속 렌더가
        // 진행되면 결과 영상이 garbage 가 되고 Lambda 비용·시간만 낭비된다.
        // 사용자가 JSON 또는 환경을 고친 뒤 재시작하면 캐시된 정상 씬은 재사용된다.
        await this.visualProvider.record(scene, outputPath, lecture.lecture_id);

        // #141 F-2: capture 직후 manifest 와 audio 길이 비교.
        // 순방향 싱크 대상 씬에서 1초 이상 어긋나면 calibration 편향 또는
        // sync-playwright 미실행 가능성이 높다.
        await this.validateRecordingDuration(lecture.lecture_id, scene, outputPath);
      }
    }
  }

  private async validateRecordingDuration(
    lectureId: string,
    scene: Scene,
    capturePath: string,
  ): Promise<void> {
    if (!this.audioDurationProbe) return;
    if (!isForwardSyncTarget(scene)) return;

    const manifestPath = capturePath.replace(/\.\w+$/, '.manifest.json');
    if (!await fs.pathExists(manifestPath)) return;

    let manifestDurationMs: number;
    try {
      const manifest = await fs.readJson(manifestPath);
      if (typeof manifest.totalDurationMs !== 'number') return;
      manifestDurationMs = manifest.totalDurationMs;
    } catch {
      return;
    }

    const audioPath = this.lectureRepository.getAudioPath(lectureId, scene.scene_id);
    const audioDurationMs = await this.audioDurationProbe.probeDurationMs(audioPath);
    if (audioDurationMs === null) {
      // audio 가 아직 없는 단계는 정상 (TTS 전 사전 녹화 등). 검증 생략.
      return;
    }

    const diffMs = manifestDurationMs - audioDurationMs;
    const absMs = Math.abs(diffMs);
    if (absMs <= DURATION_DIFF_WARN_MS) return;

    const sign = diffMs >= 0 ? '+' : '-';
    const absSec = (absMs / 1000).toFixed(2);
    const manifestSec = (manifestDurationMs / 1000).toFixed(2);
    const audioSec = (audioDurationMs / 1000).toFixed(2);
    const direction = diffMs >= 0
      ? 'webm 이 audio 보다 길게 끝남 (후반 무음/타이핑 꼬리 위험)'
      : 'webm 이 audio 보다 짧게 끝남 (마지막 narration 이 잘릴 위험)';
    const severity = absMs >= DURATION_DIFF_ERROR_MS ? '⛔' : '⚠️';
    const tag = absMs >= DURATION_DIFF_ERROR_MS ? '[F-2 critical]' : '[F-2 warning]';

    console.warn(
      `  ${severity} ${tag} Scene ${scene.scene_id}: webm ${manifestSec}s vs audio ${audioSec}s ` +
      `(${sign}${absSec}s) — ${direction}. ` +
      `sync-playwright 재실행 또는 ActionTiming calibration 점검 필요.`,
    );
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
