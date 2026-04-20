import * as https from 'https';

export interface GeminiApiClientOptions {
  timeoutMs?: number;
}

export class GeminiApiClient {
  private readonly timeoutMs: number;

  constructor(options: GeminiApiClientOptions = {}) {
    this.timeoutMs = options.timeoutMs ?? 2 * 60 * 1000;
  }

  async postJson(url: string, payload: unknown): Promise<{ status: number; ok: boolean; json: any }> {
    const body = JSON.stringify(payload);
    const targetUrl = new URL(url);

    return new Promise((resolve, reject) => {
      const request = https.request(
        {
          protocol: targetUrl.protocol,
          hostname: targetUrl.hostname,
          port: targetUrl.port || undefined,
          path: `${targetUrl.pathname}${targetUrl.search}`,
          method: 'POST',
          family: 4,
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(body),
          },
        },
        response => {
          const chunks: Buffer[] = [];
          response.on('data', chunk => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
          response.on('end', () => {
            const raw = Buffer.concat(chunks).toString('utf8');
            if (!raw) {
              resolve({ status: response.statusCode ?? 0, ok: this.isOk(response.statusCode), json: {} });
              return;
            }
            try {
              resolve({
                status: response.statusCode ?? 0,
                ok: this.isOk(response.statusCode),
                json: JSON.parse(raw),
              });
            } catch (cause) {
              reject(new Error(`Gemini API 응답 JSON 파싱 실패: ${raw.substring(0, 300)}`, { cause }));
            }
          });
        },
      );

      request.setTimeout(this.timeoutMs, () => {
        request.destroy(new Error(`Gemini API 요청 타임아웃 (${this.timeoutMs}ms)`));
      });
      request.on('error', reject);
      request.write(body);
      request.end();
    });
  }

  private isOk(statusCode?: number): boolean {
    return (statusCode ?? 0) >= 200 && (statusCode ?? 0) < 300;
  }
}
