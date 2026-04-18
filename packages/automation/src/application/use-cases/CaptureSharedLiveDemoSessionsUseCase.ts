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
      if (sceneIds && !group.sceneIds.some(id => sceneIds.includes(id))) continue;

      if (!force && await this.allSceneManifestsExist(lecture.lecture_id, group.sessionId, group.sceneIds)) {
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

          if (!force && await fs.pathExists(path.join(outputDir, 'manifest.json'))) {
            console.log(`- Scene ${sceneId} 매니페스트 이미 존재함 (스킵)`);
            continue;
          }

          try {
            await this.sharedProvider.captureSceneInSession(handle, scene, outputDir);
          } catch (err: any) {
            console.error(`- Scene ${sceneId} 공유 세션 캡처 실패:`, err.message);
          }
        }
      } finally {
        await this.sharedProvider.closeSession(handle);
      }
    }
  }

  private async allSceneManifestsExist(lectureId: string, sessionId: string, sceneIds: number[]): Promise<boolean> {
    for (const sceneId of sceneIds) {
      const manifestPath = path.join(
        this.lectureRepository.getSessionSceneCaptureDir(lectureId, sessionId, sceneId),
        'manifest.json',
      );
      if (!await fs.pathExists(manifestPath)) return false;
    }
    return true;
  }
}
