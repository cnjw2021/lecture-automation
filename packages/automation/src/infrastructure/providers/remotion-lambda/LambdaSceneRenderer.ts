import { deleteRender, downloadMedia } from '@remotion/lambda';
import { renderMediaOnLambda } from '@remotion/lambda/client';
import * as fs from 'fs-extra';
import * as path from 'path';
import { SceneClipRenderRequest } from '../../../domain/interfaces/ISceneClipRenderProvider';
import { findSceneById } from '../../../domain/utils/LectureSceneLookup';
import { SharedSessionManifestLoader } from '../../services/SharedSessionManifestLoader';
import { LambdaRenderConfig } from './types';
import { LambdaRenderProgressPoller } from './LambdaRenderProgressPoller';
import { ILambdaRenderProgressRenderer } from './LambdaRenderProgressRenderer';

export class LambdaSceneRenderer {
  constructor(
    private readonly progressPoller: LambdaRenderProgressPoller,
    private readonly sharedSessionManifestLoader: SharedSessionManifestLoader,
    private readonly progressRenderer: ILambdaRenderProgressRenderer,
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
    const scene = findSceneById(request.lectureData, request.sceneId);
    const sceneDurationSec = request.audioDurations[request.sceneId.toString()];
    const sceneAudioDurations = typeof sceneDurationSec === 'number'
      ? { [request.sceneId.toString()]: sceneDurationSec }
      : {};
    const singleSceneLectureData = {
      lecture_id: request.lectureId,
      sequence: [scene],
    };

    this.progressRenderer.startScene(request.sceneId);

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
      framesPerLambda: lambdaConfig.framesPerLambda,
      ...(lambdaConfig.tabConcurrency && { concurrency: lambdaConfig.tabConcurrency }),
      outName: `scene-${request.sceneId}.mp4`,
      overwrite: true,
      privacy: lambdaConfig.privacy,
      logLevel: 'info',
    });

    if (cloudWatchLogs) {
      this.progressRenderer.noteRenderId(request.sceneId, renderId);
    }

    try {
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
            this.progressRenderer.downloadComplete(request.sceneId);
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

      const elapsed = (Date.now() - startTime) / 1000;
      this.progressRenderer.completeScene(request.sceneId, elapsed);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.progressRenderer.failScene(request.sceneId, message);
      throw error;
    }
  }
}
