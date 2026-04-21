import type { AwsRegion } from '@remotion/lambda';
import { LambdaRenderConfig } from './types';

export class LambdaRenderConfigReader {
  read(): LambdaRenderConfig {
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
      maxConcurrentScenes: this.readPositiveIntegerEnv('REMOTION_LAMBDA_CONCURRENCY', 20),
      pollIntervalMs: this.readPositiveIntegerEnv('REMOTION_LAMBDA_POLL_INTERVAL_MS', 5000),
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

  private readPositiveIntegerEnv(envName: string, fallback: number): number {
    const raw = process.env[envName];
    if (!raw) return fallback;

    const value = Number.parseInt(raw, 10);
    if (!Number.isFinite(value) || value <= 0) {
      throw new Error(`${envName}는 양의 정수여야 합니다: ${raw}`);
    }
    return value;
  }
}
