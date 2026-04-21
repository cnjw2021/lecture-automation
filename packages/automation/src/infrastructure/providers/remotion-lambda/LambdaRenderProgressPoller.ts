import type { AwsRegion } from '@remotion/lambda';
import { getRenderProgress, type RenderProgress } from '@remotion/lambda/client';
import { ILambdaRenderProgressRenderer } from './LambdaRenderProgressRenderer';

export interface LambdaRenderProgressPollInput {
  sceneId: number;
  region: AwsRegion;
  functionName: string;
  bucketName: string;
  renderId: string;
  pollIntervalMs: number;
}

export class LambdaRenderProgressPoller {
  constructor(private readonly progressRenderer: ILambdaRenderProgressRenderer) {}

  async waitForCompletion(input: LambdaRenderProgressPollInput): Promise<RenderProgress> {
    while (true) {
      const progress = await getRenderProgress({
        region: input.region,
        functionName: input.functionName,
        bucketName: input.bucketName,
        renderId: input.renderId,
      });

      if (progress.fatalErrorEncountered) {
        const message = progress.errors
          .map(error => error.message)
          .filter(Boolean)
          .join('\n');
        throw new Error(`Scene ${input.sceneId} Lambda 렌더링 실패: ${message || 'unknown error'}`);
      }

      const percent = Math.floor(progress.overallProgress * 100);
      const totalChunks = progress.renderMetadata ? progress.renderMetadata.totalChunks : null;
      this.progressRenderer.updateProgress(input.sceneId, percent, progress.chunks, totalChunks);

      if (progress.done) {
        return progress;
      }

      await this.delay(input.pollIntervalMs);
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
