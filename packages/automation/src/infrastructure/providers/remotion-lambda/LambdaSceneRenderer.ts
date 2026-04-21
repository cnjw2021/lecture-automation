import { deleteRender, downloadMedia } from '@remotion/lambda';
import { renderMediaOnLambda } from '@remotion/lambda/client';
import * as fs from 'fs-extra';
import * as path from 'path';
import { Scene } from '../../../domain/entities/Lecture';
import { SceneClipRenderRequest } from '../../../domain/interfaces/ISceneClipRenderProvider';
import { SharedSessionManifestLoader } from '../../services/SharedSessionManifestLoader';
import { LambdaRenderConfig } from './types';
import { LambdaRenderProgressPoller } from './LambdaRenderProgressPoller';

export class LambdaSceneRenderer {
  constructor(
    private readonly progressPoller: LambdaRenderProgressPoller,
    private readonly sharedSessionManifestLoader: SharedSessionManifestLoader,
  ) {}

  async renderScene(
    request: SceneClipRenderRequest,
    lambdaConfig: LambdaRenderConfig,
    serveUrl: string,
  ): Promise<void> {
    const startTime = Date.now();
    await fs.ensureDir(path.dirname(request.outPath));

    const synthManifests = await this.sharedSessionManifestLoader.load(
      request.lectureId,
      request.sceneId,
      request.lectureData,
    );
    const scene = this.findScene(request);
    const sceneDurationSec = request.audioDurations[request.sceneId.toString()];
    const sceneAudioDurations = typeof sceneDurationSec === 'number'
      ? { [request.sceneId.toString()]: sceneDurationSec }
      : {};
    const singleSceneLectureData = {
      lecture_id: request.lectureId,
      sequence: [scene],
    };

    console.log(`  🎞️  Scene ${request.sceneId} Lambda 렌더링 시작`);

    const { bucketName, renderId, cloudWatchLogs } = await renderMediaOnLambda({
      region: lambdaConfig.region,
      functionName: lambdaConfig.functionName,
      serveUrl,
      composition: 'SingleScene',
      inputProps: {
        lectureData: singleSceneLectureData,
        audioDurations: sceneAudioDurations,
        sceneId: request.sceneId,
        ...(synthManifests && { synthManifests }),
      },
      codec: 'h264',
      audioCodec: 'aac',
      concurrency: 1,
      outName: `scene-${request.sceneId}.mp4`,
      overwrite: true,
      privacy: lambdaConfig.privacy,
      logLevel: 'info',
    });

    if (cloudWatchLogs) {
      console.log(`      Scene ${request.sceneId} renderId=${renderId}`);
    }

    await this.progressPoller.waitForCompletion({
      sceneId: request.sceneId,
      region: lambdaConfig.region,
      functionName: lambdaConfig.functionName,
      bucketName,
      renderId,
      pollIntervalMs: lambdaConfig.pollIntervalMs,
    });

    await downloadMedia({
      region: lambdaConfig.region,
      bucketName,
      renderId,
      outPath: request.outPath,
      onProgress: ({ percent }) => {
        if (percent === 1) {
          console.log(`      Scene ${request.sceneId} 다운로드 완료`);
        }
      },
    });

    if (lambdaConfig.cleanupRenders) {
      await deleteRender({
        region: lambdaConfig.region,
        bucketName,
        renderId,
      });
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`    ✅ Scene ${request.sceneId} Lambda 완료 (${elapsed}초)`);
  }

  private findScene(request: SceneClipRenderRequest): Scene {
    const scene = request.lectureData.sequence.find(item => item.scene_id === request.sceneId);
    if (!scene) {
      throw new Error(`Scene ${request.sceneId}을 lecture data에서 찾을 수 없습니다.`);
    }
    return scene;
  }
}
