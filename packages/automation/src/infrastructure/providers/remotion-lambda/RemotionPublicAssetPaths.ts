import * as path from 'path';
import { config } from '../../config';
import { RemotionPublicAsset } from './types';

export class RemotionPublicAssetPaths {
  audio(lectureId: string, sceneId: number): RemotionPublicAsset {
    return {
      localPath: path.join(config.paths.audio, lectureId, `scene-${sceneId}.wav`),
      publicPath: `audio/${lectureId}/scene-${sceneId}.wav`,
      required: true,
    };
  }

  capture(lectureId: string, sceneId: number): RemotionPublicAsset {
    return {
      localPath: path.join(config.paths.captures, lectureId, `scene-${sceneId}.webm`),
      publicPath: `captures/${lectureId}/scene-${sceneId}.webm`,
      required: true,
    };
  }

  screenshot(lectureId: string, sceneId: number): RemotionPublicAsset {
    return {
      localPath: path.join(config.paths.screenshots, lectureId, `scene-${sceneId}.png`),
      publicPath: `screenshots/${lectureId}/scene-${sceneId}.png`,
      required: true,
    };
  }

  stateCaptureSceneDir(lectureId: string, sessionId: string, sceneId: number): string {
    return `state-captures/${lectureId}/session-${sessionId}/scene-${sceneId}`;
  }

  stateCaptureFile(
    lectureId: string,
    sessionId: string,
    sceneId: number,
    localPath: string,
    relativePath: string,
  ): RemotionPublicAsset {
    return {
      localPath,
      publicPath: `${this.stateCaptureSceneDir(lectureId, sessionId, sceneId)}/${relativePath}`,
      required: true,
    };
  }

  toS3Key(sitePrefix: string, publicPath: string): string {
    return [sitePrefix, publicPath]
      .filter(Boolean)
      .map(part => part.replace(/^\/+|\/+$/g, ''))
      .join('/');
  }
}
