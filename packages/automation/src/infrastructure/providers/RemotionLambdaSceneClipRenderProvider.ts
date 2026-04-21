import {
  DeleteObjectsCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import {
  deleteRender,
  deploySite,
  downloadMedia,
  getOrCreateBucket,
  type AwsRegion,
} from '@remotion/lambda';
import {
  getRenderProgress,
  renderMediaOnLambda,
  type RenderProgress,
} from '@remotion/lambda/client';
import * as nodeFs from 'fs';
import * as fs from 'fs-extra';
import * as path from 'path';
import { Lecture, Scene } from '../../domain/entities/Lecture';
import {
  ISceneClipRenderProvider,
  SceneClipRenderRequest,
} from '../../domain/interfaces/ISceneClipRenderProvider';
import { isSharedSessionScene } from '../../domain/policies/LiveDemoScenePolicy';
import { config } from '../config';
import { ILectureRepository } from '../../domain/interfaces/ILectureRepository';

interface LambdaRenderConfig {
  region: AwsRegion;
  functionName: string;
  serveUrl?: string;
  siteName: string;
  forceDeploy: boolean;
  bucketName?: string;
  maxConcurrentScenes: number;
  pollIntervalMs: number;
  cleanupAssets: boolean;
  cleanupRenders: boolean;
  privacy: 'public' | 'private' | 'no-acl';
}

interface ParsedServeUrl {
  bucketName: string;
  sitePrefix: string;
}

interface UploadAsset {
  localPath: string;
  publicPath: string;
  required: boolean;
}

export class RemotionLambdaSceneClipRenderProvider implements ISceneClipRenderProvider {
  constructor(private readonly lectureRepository: ILectureRepository) {}

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

    const lambdaConfig = this.readLambdaConfig();
    const serveUrl = await this.resolveServeUrl(lambdaConfig);
    const s3Location = this.parseServeUrl(serveUrl);
    const s3 = new S3Client({ region: lambdaConfig.region });

    console.log(`  ☁️  Lambda 씬 렌더링 시작 — ${requests.length}개 씬, region=${lambdaConfig.region}`);
    console.log(`      serveUrl: ${serveUrl}`);

    const uploadedKeys = await this.uploadAssets(s3, s3Location, requests);

    try {
      await this.mapWithConcurrency(
        requests,
        lambdaConfig.maxConcurrentScenes,
        request => this.renderOneScene(request, lambdaConfig, serveUrl),
      );
    } finally {
      if (lambdaConfig.cleanupAssets && uploadedKeys.length > 0) {
        await this.deleteUploadedAssets(s3, s3Location.bucketName, uploadedKeys);
      }
    }
  }

  private async renderOneScene(
    request: SceneClipRenderRequest,
    lambdaConfig: LambdaRenderConfig,
    serveUrl: string,
  ): Promise<void> {
    const startTime = Date.now();
    await fs.ensureDir(path.dirname(request.outPath));

    const scene = this.findScene(request.lectureData, request.sceneId);
    const synthManifests = await this.loadSynthManifests(
      request.lectureId,
      request.sceneId,
      request.lectureData,
    );
    const durationInFrames = this.getSceneDurationFrames(request.sceneId, request.audioDurations);

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

    await this.waitForRender(request.sceneId, {
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
    console.log(`    ✅ Scene ${scene.scene_id} Lambda 완료 (${elapsed}초)`);
  }

  private async waitForRender(
    sceneId: number,
    input: {
      region: AwsRegion;
      functionName: string;
      bucketName: string;
      renderId: string;
      pollIntervalMs: number;
    },
  ): Promise<RenderProgress> {
    let lastLoggedPercent = -10;

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
        throw new Error(`Scene ${sceneId} Lambda 렌더링 실패: ${message || 'unknown error'}`);
      }

      const percent = Math.floor(progress.overallProgress * 100);
      if (progress.done || percent >= lastLoggedPercent + 10) {
        lastLoggedPercent = percent;
        const chunks = progress.renderMetadata
          ? `${progress.chunks}/${progress.renderMetadata.totalChunks}`
          : `${progress.chunks}`;
        console.log(`      Scene ${sceneId}: ${percent}% (chunks ${chunks})`);
      }

      if (progress.done) {
        return progress;
      }

      await this.delay(input.pollIntervalMs);
    }
  }

  private async resolveServeUrl(lambdaConfig: LambdaRenderConfig): Promise<string> {
    if (lambdaConfig.serveUrl && !lambdaConfig.forceDeploy) {
      return lambdaConfig.serveUrl;
    }

    const bucketName = lambdaConfig.bucketName
      ?? (await getOrCreateBucket({ region: lambdaConfig.region })).bucketName;
    const remotionDir = path.join(config.paths.root, 'packages/remotion');

    console.log(`  📦 Remotion site 배포 중 — bucket=${bucketName}, site=${lambdaConfig.siteName}`);
    const { serveUrl } = await deploySite({
      entryPoint: path.join(remotionDir, 'src/Root.tsx'),
      bucketName,
      region: lambdaConfig.region,
      siteName: lambdaConfig.siteName,
      options: {
        publicDir: path.join(remotionDir, 'public'),
        rootDir: remotionDir,
        onBundleProgress: progress => {
          if (progress === 100 || progress % 25 === 0) {
            console.log(`      bundle ${progress}%`);
          }
        },
        onUploadProgress: ({ filesUploaded, totalFiles }) => {
          if (filesUploaded === totalFiles) {
            console.log(`      bundle upload ${filesUploaded}/${totalFiles}`);
          }
        },
      },
    });

    console.log(`  ✅ Remotion site 배포 완료: ${serveUrl}`);
    return serveUrl;
  }

  private async uploadAssets(
    s3: S3Client,
    s3Location: ParsedServeUrl,
    requests: SceneClipRenderRequest[],
  ): Promise<string[]> {
    const assets = await this.collectAssets(requests);
    const uniqueAssets = new Map<string, UploadAsset>();

    for (const asset of assets) {
      uniqueAssets.set(asset.publicPath, asset);
    }

    const uploadedKeys = await this.mapWithConcurrency(
      Array.from(uniqueAssets.values()),
      8,
      async asset => {
        const exists = await fs.pathExists(asset.localPath);
        if (!exists) {
          if (asset.required) {
            throw new Error(`Lambda 업로드 대상 에셋 없음: ${asset.localPath}`);
          }
          return null;
        }

        const key = this.toS3Key(s3Location.sitePrefix, asset.publicPath);
        await s3.send(new PutObjectCommand({
          Bucket: s3Location.bucketName,
          Key: key,
          Body: nodeFs.createReadStream(asset.localPath),
          ContentType: this.getContentType(asset.publicPath),
        }));
        return key;
      },
    );

    const uploaded = uploadedKeys.filter((key): key is string => Boolean(key));
    console.log(`  ☁️  Lambda 에셋 업로드 완료 — ${uploaded.length}개`);
    return uploaded;
  }

  private async collectAssets(requests: SceneClipRenderRequest[]): Promise<UploadAsset[]> {
    const assets: UploadAsset[] = [];

    for (const request of requests) {
      const scene = this.findScene(request.lectureData, request.sceneId);
      assets.push({
        localPath: path.join(config.paths.audio, request.lectureId, `scene-${request.sceneId}.wav`),
        publicPath: `audio/${request.lectureId}/scene-${request.sceneId}.wav`,
        required: true,
      });

      if (scene.visual.type === 'playwright' && !isSharedSessionScene(scene)) {
        assets.push({
          localPath: path.join(config.paths.captures, request.lectureId, `scene-${request.sceneId}.webm`),
          publicPath: `captures/${request.lectureId}/scene-${request.sceneId}.webm`,
          required: true,
        });
      }

      if (scene.visual.type === 'screenshot') {
        assets.push({
          localPath: path.join(config.paths.screenshots, request.lectureId, `scene-${request.sceneId}.png`),
          publicPath: `screenshots/${request.lectureId}/scene-${request.sceneId}.png`,
          required: true,
        });
      }

      if (isSharedSessionScene(scene)) {
        const sessionId = (scene.visual as any).session!.id as string;
        const captureDir = this.lectureRepository.getSessionSceneCaptureDir(
          request.lectureId,
          sessionId,
          request.sceneId,
        );
        const publicDir = `state-captures/${request.lectureId}/session-${sessionId}/scene-${request.sceneId}`;
        const files = await this.listFilesRecursive(captureDir);
        for (const file of files) {
          const rel = this.toPosix(path.relative(captureDir, file));
          assets.push({
            localPath: file,
            publicPath: `${publicDir}/${rel}`,
            required: true,
          });
        }
      }
    }

    return assets;
  }

  private async deleteUploadedAssets(s3: S3Client, bucketName: string, keys: string[]): Promise<void> {
    const uniqueKeys = Array.from(new Set(keys));
    for (let i = 0; i < uniqueKeys.length; i += 1000) {
      const batch = uniqueKeys.slice(i, i + 1000);
      await s3.send(new DeleteObjectsCommand({
        Bucket: bucketName,
        Delete: {
          Objects: batch.map(Key => ({ Key })),
          Quiet: true,
        },
      }));
    }
    console.log(`  🧹 Lambda 업로드 에셋 정리 완료 — ${uniqueKeys.length}개`);
  }

  private parseServeUrl(serveUrl: string): ParsedServeUrl {
    const url = new URL(serveUrl);
    const pathParts = decodeURIComponent(url.pathname)
      .replace(/^\/+/, '')
      .split('/')
      .filter(Boolean);

    let bucketName = '';
    let siteParts = pathParts;
    const virtualHostedMatch = url.hostname.match(/^([^.]+)\.s3[.-]/);

    if (virtualHostedMatch) {
      bucketName = virtualHostedMatch[1];
    } else if (url.hostname === 's3.amazonaws.com' || url.hostname.startsWith('s3.')) {
      bucketName = pathParts[0] ?? '';
      siteParts = pathParts.slice(1);
    }

    if (!bucketName) {
      throw new Error(`REMOTION_SERVE_URL에서 S3 bucket을 파싱할 수 없습니다: ${serveUrl}`);
    }

    if (siteParts[siteParts.length - 1] === 'index.html') {
      siteParts = siteParts.slice(0, -1);
    }

    return {
      bucketName,
      sitePrefix: siteParts.join('/'),
    };
  }

  private toS3Key(sitePrefix: string, publicPath: string): string {
    return [sitePrefix, publicPath]
      .filter(Boolean)
      .map(part => part.replace(/^\/+|\/+$/g, ''))
      .join('/');
  }

  private readLambdaConfig(): LambdaRenderConfig {
    const functionName = process.env.REMOTION_LAMBDA_FUNCTION_NAME?.trim();
    if (!functionName) {
      throw new Error('REMOTION_LAMBDA_FUNCTION_NAME 환경변수가 필요합니다.');
    }

    return {
      region: (process.env.AWS_REGION || 'us-east-1') as AwsRegion,
      functionName,
      serveUrl: process.env.REMOTION_SERVE_URL?.trim() || undefined,
      siteName: process.env.REMOTION_LAMBDA_SITE_NAME?.trim() || 'lecture-automation',
      forceDeploy: process.env.REMOTION_LAMBDA_DEPLOY === '1',
      bucketName: process.env.REMOTION_LAMBDA_BUCKET_NAME?.trim() || undefined,
      maxConcurrentScenes: this.readPositiveInteger('REMOTION_LAMBDA_CONCURRENCY', Number.POSITIVE_INFINITY),
      pollIntervalMs: this.readPositiveInteger('REMOTION_LAMBDA_POLL_INTERVAL_MS', 5000),
      cleanupAssets: process.env.REMOTION_LAMBDA_CLEANUP_ASSETS !== '0',
      cleanupRenders: process.env.REMOTION_LAMBDA_CLEANUP_RENDERS !== '0',
      privacy: this.readPrivacy(),
    };
  }

  private readPrivacy(): LambdaRenderConfig['privacy'] {
    const value = process.env.REMOTION_LAMBDA_PRIVACY?.trim();
    if (!value) return 'private';
    if (value === 'public' || value === 'private' || value === 'no-acl') return value;
    throw new Error(`REMOTION_LAMBDA_PRIVACY 값이 잘못되었습니다: ${value}`);
  }

  private readPositiveInteger(envName: string, fallback: number): number {
    const raw = process.env[envName];
    if (!raw) return fallback;

    const value = Number.parseInt(raw, 10);
    if (!Number.isFinite(value) || value <= 0) {
      throw new Error(`${envName}는 양의 정수여야 합니다: ${raw}`);
    }
    return value;
  }

  private getSceneDurationFrames(sceneId: number, audioDurations: Record<string, number>): number {
    const videoConfig = config.getVideoConfig();
    const scenePaddingSec = videoConfig.scenePaddingSec ?? 0.5;
    const durationSec = audioDurations[sceneId.toString()] || 10;
    return Math.ceil((durationSec + scenePaddingSec) * videoConfig.fps);
  }

  private findScene(lecture: Lecture, sceneId: number): Scene {
    const scene = lecture.sequence.find(item => item.scene_id === sceneId);
    if (!scene) {
      throw new Error(`Scene ${sceneId}을 lecture data에서 찾을 수 없습니다.`);
    }
    return scene;
  }

  private async loadSynthManifests(
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
      throw new Error(`Scene ${sceneId} shared session manifest 없음: ${manifestPath}`);
    }

    const manifest = await fs.readJson(manifestPath);
    return { [sceneId.toString()]: manifest };
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

  private async mapWithConcurrency<T, R>(
    items: T[],
    concurrency: number,
    mapper: (item: T) => Promise<R>,
  ): Promise<R[]> {
    if (items.length === 0) return [];

    const limit = Number.isFinite(concurrency)
      ? Math.max(1, Math.min(items.length, concurrency))
      : items.length;
    const results: R[] = new Array(items.length);
    let nextIndex = 0;

    const workers = Array.from({ length: limit }, async () => {
      while (nextIndex < items.length) {
        const currentIndex = nextIndex++;
        results[currentIndex] = await mapper(items[currentIndex]);
      }
    });

    await Promise.all(workers);
    return results;
  }

  private getContentType(filePath: string): string | undefined {
    const ext = path.extname(filePath).toLowerCase();
    switch (ext) {
      case '.wav':
        return 'audio/wav';
      case '.webm':
        return 'video/webm';
      case '.mp4':
        return 'video/mp4';
      case '.png':
        return 'image/png';
      case '.jpg':
      case '.jpeg':
        return 'image/jpeg';
      case '.svg':
        return 'image/svg+xml';
      case '.json':
        return 'application/json';
      default:
        return undefined;
    }
  }

  private toPosix(value: string): string {
    return value.split(path.sep).join('/');
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
