import * as fs from 'fs-extra';
import * as path from 'path';
import { Lecture } from '../../domain/entities/Lecture';
import { ILectureRepository } from '../../domain/interfaces/ILectureRepository';
import {
  ISharedVisualSessionProvider,
  LiveDemoSessionPlan,
} from '../../domain/interfaces/ISharedVisualSessionProvider';
import { planLiveDemoSessions } from '../../domain/policies/LiveDemoScenePolicy';

export interface CaptureSharedLiveDemoSessionsOptions {
  force?: boolean;
  sceneIds?: number[];
}

/**
 * 공유 브라우저 세션(P-D)에 속한 모든 shared Playwright 씬을 세션 단위로 캡처한다.
 *
 * 파이프라인 3a단계에서 호출된다. isolated 라이브 데모는 대상이 아님(기존 Stage 0/3 경로 유지).
 *
 * 부분 재생성 (sceneIds 지정) 시의 처리:
 *   - 그룹 내 씬을 순서대로 실행한다.
 *   - 캡처 대상이 아닌 선행 씬은 replayOnly 모드로 실행해 페이지 상태를 복원한다.
 *   - 캡처 대상 씬(force, sceneIds 지정, 또는 매니페스트 없음)은 스크린샷·매니페스트를 저장한다.
 *   - 이렇게 하면 "씬 29만 재생성" 시에도 씬 28의 page 상태(AI 응답 완료 후)를 올바르게 이어받는다.
 */
export class CaptureSharedLiveDemoSessionsUseCase {
  constructor(
    private readonly sharedProvider: ISharedVisualSessionProvider,
    private readonly lectureRepository: ILectureRepository,
  ) {}

  async execute(lecture: Lecture, options: CaptureSharedLiveDemoSessionsOptions = {}): Promise<void> {
    const groups = planLiveDemoSessions(lecture);
    if (groups.length === 0) return;

    const { force = false, sceneIds } = options;
    const sceneById = new Map(lecture.sequence.map(s => [s.scene_id, s]));

    for (const group of groups) {
      // sceneIds가 지정됐고 이 그룹에 해당 씬이 없으면 스킵
      if (sceneIds && !group.sceneIds.some(id => sceneIds.includes(id))) continue;

      // 그룹 내 캡처가 필요한 씬이 하나도 없으면 스킵
      const needsAnyCapture = await this.groupNeedsCapture(lecture.lecture_id, group.sessionId, group.sceneIds, force, sceneIds);
      if (!needsAnyCapture) {
        console.log(`- Session ${group.sessionId} 모든 씬 매니페스트 존재 (스킵)`);
        continue;
      }

      const plan: LiveDemoSessionPlan = {
        lectureId: lecture.lecture_id,
        sessionId: group.sessionId,
        storageState: group.storageState,
        sceneIds: group.sceneIds,
      };

      const handle = await this.sharedProvider.openSession(plan);
      try {
        for (const sceneId of group.sceneIds) {
          const scene = sceneById.get(sceneId);
          if (!scene) continue;

          const outputDir = this.lectureRepository.getSessionSceneCaptureDir(
            lecture.lecture_id, group.sessionId, sceneId,
          );

          const needsCapture = force
            || (sceneIds?.includes(sceneId) ?? false)
            || !await fs.pathExists(path.join(outputDir, 'manifest.json'));

          // 캡처 불필요 씬: replayOnly で実行してページ状態だけ復元
          const replayOnly = !needsCapture;

          // 실패(replayOnly/capture 모두) 시 throw → finally で closeSession 후 호출부로 전파
          await this.sharedProvider.captureSceneInSession(handle, scene, outputDir, { replayOnly });
        }
      } finally {
        await this.sharedProvider.closeSession(handle);
      }
    }
  }

  /** 그룹 내 하나 이상의 씬이 캡처(또는 재캡처)를 필요로 하는지 판정 */
  private async groupNeedsCapture(
    lectureId: string,
    sessionId: string,
    sceneIds: number[],
    force: boolean,
    targetSceneIds?: number[],
  ): Promise<boolean> {
    for (const id of sceneIds) {
      if (force || (targetSceneIds?.includes(id) ?? false)) return true;
      const manifestPath = path.join(
        this.lectureRepository.getSessionSceneCaptureDir(lectureId, sessionId, id),
        'manifest.json',
      );
      if (!await fs.pathExists(manifestPath)) return true;
    }
    return false;
  }
}
