import { deleteRender, downloadMedia } from '@remotion/lambda';
import { renderMediaOnLambda } from '@remotion/lambda/client';
import * as fs from 'fs-extra';
import * as path from 'path';
import { SceneClipRenderRequest } from '../../../domain/interfaces/ISceneClipRenderProvider';
import { SceneDurationFrameCalculator } from '../../services/SceneDurationFrameCalculator';
import { SharedSessionManifestLoader } from '../../services/SharedSessionManifestLoader';
import { LambdaRenderConfig } from './types';
import { LambdaRenderProgressPoller } from './LambdaRenderProgressPoller';

export class LambdaSceneRenderer {
  constructor(
    private readonly durationFrameCalculator: SceneDurationFrameCalculator,
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
    const durationInFrames = this.durationFrameCalculator.getDurationFrames(
      request.sceneId,
      request.audioDurations,
    );

    console.log(`  🎞️  Scene ${request.sceneId} Lambda 렌더링 시작 (${durationInFrames} frames)`);

    const { bucketName, renderId, cloudWatchLogs } = await renderMediaOnLambda({
      region: lambdaConfig.region,
      functionName: lambdaConfig.functionName,
      serveUrl,
      composition: 'SingleScene',
      inputProps: {
        lectureData: request.lectureData,
        audioDurations: request.audioDurations,
        sceneId: request.sceneId,
        ...(synthManifests && { synthManifests }),
      },
      codec: 'h264',
      audioCodec: 'aac',
      framesPerLambda: Math.max(durationInFrames, 4),
      forceDurationInFrames: durationInFrames,
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
}
