import * as fs from 'fs-extra';
import * as path from 'path';
import { Scene } from '../../../domain/entities/Lecture';
import { ILectureRepository } from '../../../domain/interfaces/ILectureRepository';
import { SceneClipRenderRequest } from '../../../domain/interfaces/ISceneClipRenderProvider';
import { isSharedSessionScene } from '../../../domain/policies/LiveDemoScenePolicy';
import { findSceneById } from '../../../domain/utils/LectureSceneLookup';
import { RemotionPublicAssetPaths } from './RemotionPublicAssetPaths';
import { RemotionPublicAsset } from './types';

export class RemotionPublicAssetCollector {
  constructor(
    private readonly lectureRepository: ILectureRepository,
    private readonly assetPaths = new RemotionPublicAssetPaths(),
  ) {}

  async collect(requests: SceneClipRenderRequest[]): Promise<RemotionPublicAsset[]> {
    const assets: RemotionPublicAsset[] = [];

    for (const request of requests) {
      const scene = findSceneById(request.lectureData, request.sceneId);
      assets.push(this.assetPaths.audio(request.lectureId, request.sceneId));

      if (scene.visual.type === 'playwright' && !isSharedSessionScene(scene)) {
        assets.push(this.assetPaths.capture(request.lectureId, request.sceneId));
      }

      if (scene.visual.type === 'screenshot') {
        assets.push(this.assetPaths.screenshot(request.lectureId, request.sceneId));
      }

      if (isSharedSessionScene(scene)) {
        assets.push(...await this.collectSharedSessionAssets(request, scene));
      }
    }

    return assets;
  }

  private async collectSharedSessionAssets(
    request: SceneClipRenderRequest,
    scene: Scene,
  ): Promise<RemotionPublicAsset[]> {
    const sessionId = (scene.visual as any).session!.id as string;
    const captureDir = this.lectureRepository.getSessionSceneCaptureDir(
      request.lectureId,
      sessionId,
      request.sceneId,
    );
    const files = await this.listFilesRecursive(captureDir);

    return files
      .map(file => ({
        file,
        relativePath: this.toPosix(path.relative(captureDir, file)),
      }))
      .filter(({ relativePath }) => relativePath !== 'manifest.json')
      .map(({ file, relativePath }) => this.assetPaths.stateCaptureFile(
        request.lectureId,
        sessionId,
        request.sceneId,
        file,
        relativePath,
      ));
  }

  private async listFilesRecursive(dir: string): Promise<string[]> {
    if (!await fs.pathExists(dir)) {
      throw new Error(`Lambda 업로드 대상 디렉터리 없음: ${dir}`);
    }

    const entries = await fs.readdir(dir);
    const files: string[] = [];
    for (const entry of entries) {
      const fullPath = path.join(dir, entry);
      const stat = await fs.stat(fullPath);
      if (stat.isDirectory()) {
        files.push(...await this.listFilesRecursive(fullPath));
      } else if (stat.isFile()) {
        files.push(fullPath);
      }
    }
    return files;
  }

  private toPosix(value: string): string {
    return value.split(path.sep).join('/');
  }
}
