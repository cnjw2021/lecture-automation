import { deploySite, getOrCreateBucket } from '@remotion/lambda';
import * as path from 'path';
import { config } from '../../infrastructure/config';
import { LambdaRenderConfigReader } from '../../infrastructure/providers/remotion-lambda/LambdaRenderConfigReader';

async function main() {
  const lambdaConfig = new LambdaRenderConfigReader().read();
  const remotionDir = path.join(config.paths.root, 'packages/remotion');

  const bucketName = lambdaConfig.bucketName
    ?? (await getOrCreateBucket({ region: lambdaConfig.region })).bucketName;

  console.log(`📦 Remotion site 배포 중 — region=${lambdaConfig.region}, bucket=${bucketName}, site=${lambdaConfig.siteName}`);

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
          console.log(`    bundle ${progress}%`);
        }
      },
      onUploadProgress: ({ filesUploaded, totalFiles }) => {
        if (filesUploaded === totalFiles) {
          console.log(`    upload ${filesUploaded}/${totalFiles} files`);
        }
      },
    },
  });

  console.log(`\n✅ 배포 완료`);
  console.log(`\nREMOTION_SERVE_URL=${serveUrl}`);
  console.log(`\n.env 의 REMOTION_SERVE_URL 을 위 값으로 업데이트하세요.`);
}

main().catch(err => {
  console.error('배포 실패:', err);
  process.exit(1);
});
