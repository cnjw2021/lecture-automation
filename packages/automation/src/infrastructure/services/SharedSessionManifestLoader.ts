import * as fs from 'fs-extra';
import * as path from 'path';
import { Lecture } from '../../domain/entities/Lecture';
import { ILectureRepository } from '../../domain/interfaces/ILectureRepository';
import { isSharedSessionScene } from '../../domain/policies/LiveDemoScenePolicy';

export class SharedSessionManifestLoader {
  constructor(private readonly lectureRepository: ILectureRepository) {}

  async load(
    lectureId: string,
    sceneId: number,
    lectureData: Lecture,
  ): Promise<Record<string, unknown> | null> {
    const scene = lectureData.sequence.find(s => s.scene_id === sceneId);
    if (!scene || !isSharedSessionScene(scene)) return null;

    const sessionId = (scene.visual as any).session!.id as string;
    const manifestPath = path.join(
      this.lectureRepository.getSessionSceneCaptureDir(lectureId, sessionId, sceneId),
      'manifest.json',
    );

    if (!await fs.pathExists(manifestPath)) {
      // shared 씬은 webm 폴백이 없다(RecordVisualUseCase가 항상 스킵).
      // manifest 없이 렌더하면 잘못된 결과물이 나오므로 즉시 실패시킨다.
      throw new Error(`Scene ${sceneId} shared session manifest 없음: ${manifestPath}\n  → 캡처를 먼저 실행하세요: make regen-scene LECTURE=... SCENE=${sceneId}`);
    }

    const manifest = await fs.readJson(manifestPath);
    return { [sceneId.toString()]: manifest };
  }
}
