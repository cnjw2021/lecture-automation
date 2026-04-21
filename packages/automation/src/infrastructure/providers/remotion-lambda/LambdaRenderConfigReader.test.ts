import { LambdaRenderConfigReader } from './LambdaRenderConfigReader';

describe('LambdaRenderConfigReader', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.AWS_REGION;
    delete process.env.REMOTION_SERVE_URL;
    delete process.env.REMOTION_LAMBDA_SITE_NAME;
    delete process.env.REMOTION_LAMBDA_DEPLOY;
    delete process.env.REMOTION_LAMBDA_BUCKET_NAME;
    delete process.env.REMOTION_LAMBDA_CONCURRENCY;
    delete process.env.REMOTION_LAMBDA_POLL_INTERVAL_MS;
    delete process.env.REMOTION_LAMBDA_CLEANUP_ASSETS;
    delete process.env.REMOTION_LAMBDA_CLEANUP_RENDERS;
    delete process.env.REMOTION_LAMBDA_PRIVACY;
    process.env.REMOTION_LAMBDA_FUNCTION_NAME = 'remotion-render-test';
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('uses bounded defaults', () => {
    const config = new LambdaRenderConfigReader().read();

    expect(config.region).toBe('us-east-1');
    expect(config.functionName).toBe('remotion-render-test');
    expect(config.siteName).toBe('lecture-automation');
    expect(config.maxConcurrentScenes).toBe(20);
    expect(config.pollIntervalMs).toBe(5000);
    expect(config.cleanupAssets).toBe(true);
    expect(config.cleanupRenders).toBe(true);
    expect(config.privacy).toBe('private');
  });

  it('reads explicit concurrency and privacy', () => {
    process.env.REMOTION_LAMBDA_CONCURRENCY = '12';
    process.env.REMOTION_LAMBDA_PRIVACY = 'no-acl';

    const config = new LambdaRenderConfigReader().read();

    expect(config.maxConcurrentScenes).toBe(12);
    expect(config.privacy).toBe('no-acl');
  });

  it('requires a function name', () => {
    delete process.env.REMOTION_LAMBDA_FUNCTION_NAME;

    expect(() => new LambdaRenderConfigReader().read()).toThrow('REMOTION_LAMBDA_FUNCTION_NAME');
  });

  it('rejects invalid positive integer env values', () => {
    process.env.REMOTION_LAMBDA_CONCURRENCY = '0';

    expect(() => new LambdaRenderConfigReader().read()).toThrow('REMOTION_LAMBDA_CONCURRENCY');
  });

  it('rejects invalid privacy values', () => {
    process.env.REMOTION_LAMBDA_PRIVACY = 'secret';

    expect(() => new LambdaRenderConfigReader().read()).toThrow('REMOTION_LAMBDA_PRIVACY');
  });
});
