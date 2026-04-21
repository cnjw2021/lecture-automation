import {
  DeleteObjectsCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import type { AwsRegion } from '@remotion/lambda';
import * as crypto from 'crypto';
import * as nodeFs from 'fs';
import * as fs from 'fs-extra';
import * as path from 'path';
import { mapWithConcurrency } from '../../utils/mapWithConcurrency';
import { RemotionPublicAssetPaths } from './RemotionPublicAssetPaths';
import { ParsedServeUrl, RemotionPublicAsset } from './types';

export class S3AssetSyncService {
  private warnedNonMd5Etag = false;

  constructor(private readonly assetPaths = new RemotionPublicAssetPaths()) {}

  async uploadAssets(
    region: AwsRegion,
    s3Location: ParsedServeUrl,
    assets: RemotionPublicAsset[],
  ): Promise<string[]> {
    const s3 = new S3Client({ region });
    const uniqueAssets = new Map<string, RemotionPublicAsset>();
    let skipped = 0;

    for (const asset of assets) {
      uniqueAssets.set(asset.publicPath, asset);
    }

    const uploadedKeys = await mapWithConcurrency(
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

        const key = this.assetPaths.toS3Key(s3Location.sitePrefix, asset.publicPath);
        if (await this.remoteObjectMatches(s3, s3Location.bucketName, key, asset.localPath)) {
          skipped++;
          return null;
        }

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
    console.log(`  ☁️  Lambda 에셋 업로드 완료 — 업로드 ${uploaded.length}개, 스킵 ${skipped}개`);
    return uploaded;
  }

  async deleteUploadedAssets(region: AwsRegion, bucketName: string, keys: string[]): Promise<void> {
    const s3 = new S3Client({ region });
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
      default:
        return undefined;
    }
  }

  private async remoteObjectMatches(
    s3: S3Client,
    bucketName: string,
    key: string,
    localPath: string,
  ): Promise<boolean> {
    try {
      const [head, localHash] = await Promise.all([
        s3.send(new HeadObjectCommand({ Bucket: bucketName, Key: key })),
        this.calculateMd5(localPath),
      ]);
      if (head.ServerSideEncryption === 'aws:kms' || head.ServerSideEncryption === 'aws:kms:dsse') {
        this.warnNonMd5EtagOnce();
        return false;
      }

      const remoteEtag = head.ETag?.replace(/^"|"$/g, '');
      return remoteEtag === localHash;
    } catch (error) {
      const statusCode = (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
      const name = (error as { name?: string }).name;
      if (statusCode === 404 || name === 'NotFound' || name === 'NoSuchKey') {
        return false;
      }
      throw error;
    }
  }

  private warnNonMd5EtagOnce(): void {
    if (this.warnedNonMd5Etag) return;

    console.warn('  ⚠️  S3 ETag가 MD5가 아닌 SSE-KMS 객체입니다. 에셋 변경 감지를 건너뛰고 재업로드합니다.');
    this.warnedNonMd5Etag = true;
  }

  private calculateMd5(localPath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('md5');
      const stream = nodeFs.createReadStream(localPath);
      stream.on('error', reject);
      stream.on('data', chunk => hash.update(chunk));
      stream.on('end', () => resolve(hash.digest('hex')));
    });
  }
}
