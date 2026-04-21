import { ParsedServeUrl } from './types';

export class RemotionServeUrlParser {
  parse(serveUrl: string): ParsedServeUrl {
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
}
