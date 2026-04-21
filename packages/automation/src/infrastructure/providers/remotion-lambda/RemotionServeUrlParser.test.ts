import { RemotionServeUrlParser } from './RemotionServeUrlParser';

describe('RemotionServeUrlParser', () => {
  const parser = new RemotionServeUrlParser();

  it('parses path-style S3 serveUrl with index.html', () => {
    expect(parser.parse('https://s3.amazonaws.com/remotionlambda-test/sites/lecture-automation/index.html')).toEqual({
      bucketName: 'remotionlambda-test',
      sitePrefix: 'sites/lecture-automation',
    });
  });

  it('parses virtual-hosted S3 serveUrl', () => {
    expect(parser.parse('https://remotionlambda-test.s3.us-east-1.amazonaws.com/sites/lecture-automation')).toEqual({
      bucketName: 'remotionlambda-test',
      sitePrefix: 'sites/lecture-automation',
    });
  });

  it('rejects non-S3 serveUrl', () => {
    expect(() => parser.parse('https://example.com/sites/lecture-automation')).toThrow(
      'REMOTION_SERVE_URL에서 S3 bucket을 파싱할 수 없습니다',
    );
  });
});
