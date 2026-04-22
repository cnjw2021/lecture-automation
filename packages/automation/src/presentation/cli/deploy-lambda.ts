import { deploySite, getOrCreateBucket } from '@remotion/lambda';
import * as fs from 'fs-extra';
import * as path from 'path';
import { config } from '../../infrastructure/config';
import { LambdaRenderConfigReader } from '../../infrastructure/providers/remotion-lambda/LambdaRenderConfigReader';

function updateEnvFile(envPath: string, serveUrl: string): void {
  const content = fs.readFileSync(envPath, 'utf-8');
  const updated = content.replace(
    /^REMOTION_SERVE_URL=.*$/m,
    `REMOTION_SERVE_URL=${serveUrl}`,
  );
  fs.writeFileSync(envPath, updated, 'utf-8');
}

async function main() {
  const lambdaConfig = new LambdaRenderConfigReader().read();
  const remotionDir = path.join(config.paths.root, 'packages/remotion');
  const envPath = path.join(config.paths.root, '.env');

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

  if (fs.existsSync(envPath)) {
    updateEnvFile(envPath, serveUrl);
    console.log(`\n✅ 배포 완료 — .env REMOTION_SERVE_URL 갱신됨`);
  } else {
    console.log(`\n✅ 배포 완료`);
    console.log(`REMOTION_SERVE_URL=${serveUrl}`);
  }
}

main().catch(err => {
  console.error('배포 실패:', err);
  process.exit(1);
});
