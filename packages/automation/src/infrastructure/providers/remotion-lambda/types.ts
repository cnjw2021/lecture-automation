import type { AwsRegion } from '@remotion/lambda';

export interface LambdaRenderConfig {
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

export interface ParsedServeUrl {
  bucketName: string;
  sitePrefix: string;
}

export interface RemotionPublicAsset {
  localPath: string;
  publicPath: string;
  required: boolean;
}
