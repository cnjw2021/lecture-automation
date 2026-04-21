import { ISceneClipRenderProvider, SceneClipRenderRequest } from '../../domain/interfaces/ISceneClipRenderProvider';
import { ILectureRepository } from '../../domain/interfaces/ILectureRepository';
import { Lecture } from '../../domain/entities/Lecture';
import { SharedSessionManifestLoader } from '../services/SharedSessionManifestLoader';
import { mapWithConcurrency } from '../utils/mapWithConcurrency';
import { LambdaRenderConfigReader } from './remotion-lambda/LambdaRenderConfigReader';
import { LambdaRenderProgressPoller } from './remotion-lambda/LambdaRenderProgressPoller';
import { LambdaSceneRenderer } from './remotion-lambda/LambdaSceneRenderer';
import { RemotionPublicAssetCollector } from './remotion-lambda/RemotionPublicAssetCollector';
import { RemotionServeUrlParser } from './remotion-lambda/RemotionServeUrlParser';
import { RemotionServeUrlResolver } from './remotion-lambda/RemotionServeUrlResolver';
import { S3AssetSyncService } from './remotion-lambda/S3AssetSyncService';

interface RemotionLambdaSceneClipRenderProviderDeps {
  configReader: LambdaRenderConfigReader;
  serveUrlResolver: RemotionServeUrlResolver;
  serveUrlParser: RemotionServeUrlParser;
  assetCollector: RemotionPublicAssetCollector;
  assetSyncService: S3AssetSyncService;
  sceneRenderer: LambdaSceneRenderer;
}

export class RemotionLambdaSceneClipRenderProvider implements ISceneClipRenderProvider {
  private readonly deps: RemotionLambdaSceneClipRenderProviderDeps;

  constructor(
    lectureRepository: ILectureRepository,
    deps?: Partial<RemotionLambdaSceneClipRenderProviderDeps>,
  ) {
    const manifestLoader = new SharedSessionManifestLoader(lectureRepository);
    const progressPoller = new LambdaRenderProgressPoller();

    this.deps = {
      configReader: deps?.configReader ?? new LambdaRenderConfigReader(),
      serveUrlResolver: deps?.serveUrlResolver ?? new RemotionServeUrlResolver(),
      serveUrlParser: deps?.serveUrlParser ?? new RemotionServeUrlParser(),
      assetCollector: deps?.assetCollector ?? new RemotionPublicAssetCollector(lectureRepository),
      assetSyncService: deps?.assetSyncService ?? new S3AssetSyncService(),
      sceneRenderer: deps?.sceneRenderer ?? new LambdaSceneRenderer(
        progressPoller,
        manifestLoader,
      ),
    };
  }

  async renderScene(
    lectureId: string,
    sceneId: number,
    outPath: string,
    lectureData: Lecture,
    audioDurations: Record<string, number>,
  ): Promise<void> {
    await this.renderScenes([{ lectureId, sceneId, outPath, lectureData, audioDurations }]);
  }

  async renderScenes(requests: SceneClipRenderRequest[]): Promise<void> {
    if (requests.length === 0) return;

    const lambdaConfig = this.deps.configReader.read();
    const serveUrl = await this.deps.serveUrlResolver.resolve(lambdaConfig);
    const s3Location = this.deps.serveUrlParser.parse(serveUrl);

    console.log(`  ☁️  Lambda 씬 렌더링 시작 — ${requests.length}개 씬, region=${lambdaConfig.region}`);
    console.log(`      serveUrl: ${serveUrl}`);

    const assets = await this.deps.assetCollector.collect(requests);
    const uploadedKeys = await this.deps.assetSyncService.uploadAssets(
      lambdaConfig.region,
      s3Location,
      assets,
    );

    try {
      await mapWithConcurrency(
        requests,
        lambdaConfig.maxConcurrentScenes,
        request => this.deps.sceneRenderer.renderScene(request, lambdaConfig, serveUrl),
        { stopSchedulingOnError: true },
      );
    } finally {
      if (lambdaConfig.cleanupAssets && uploadedKeys.length > 0) {
        await this.deps.assetSyncService.deleteUploadedAssets(
          lambdaConfig.region,
          s3Location.bucketName,
          uploadedKeys,
        );
      }
    }
  }
}
