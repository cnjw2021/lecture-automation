import { deploySite, getOrCreateBucket } from '@remotion/lambda';
import * as path from 'path';
import { config } from '../../config';
import { LambdaRenderConfig } from './types';

export class RemotionServeUrlResolver {
  async resolve(lambdaConfig: LambdaRenderConfig): Promise<string> {
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
}
