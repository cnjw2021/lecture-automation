import * as https from 'https';
import { AudioConfig, AudioGenerateResult } from '../../domain/interfaces/IAudioProvider';
import { IMasterAudioGenerator } from '../../domain/interfaces/IMasterAudioGenerator';
import { MasterAudioGeneratorDescriptor } from '../../domain/entities/MasterAudioManifest';
import { computeMasterAudioHash } from '../../domain/utils/MasterAudioUtils';
import { pcmToWav } from './AudioUtils';

export class GeminiMasterAudioProvider implements IMasterAudioGenerator {
  private readonly baseUrl = 'https://generativelanguage.googleapis.com/v1beta/models';
  private readonly requestTimeoutMs = 10 * 60 * 1000;
  private readonly maxRetries = 3;
  private readonly baseDelayMs = 2000;

  constructor(
    private readonly apiKey: string,
    private readonly modelName: string,
    private readonly voiceName: string,
    private readonly styleVersion: string,
    private readonly prompt: string,
    private readonly audioConfig: AudioConfig,
    private readonly temperature: number,
    private readonly seed?: number,
  ) {}

  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private isRetryableError(error: unknown): boolean {
    if (!(error instanceof Error)) {
      return false;
    }

    const msg = error.message || '';
    const cause = (error as Error & { cause?: { code?: string } }).cause;
    const causeCode = cause?.code || '';
    return msg.includes('fetch failed')
      || msg.includes('Headers Timeout Error')
      || msg.includes('timeout')
      || msg.includes('socket')
      || msg.includes('network')
      || causeCode === 'ECONNRESET'
      || causeCode === 'ETIMEDOUT'
      || causeCode === 'ENOTFOUND'
      || causeCode === 'ECONNABORTED';
  }

  private async postJson(url: string, payload: unknown): Promise<{ status: number; ok: boolean; json: any }> {
    const body = JSON.stringify(payload);
    const targetUrl = new URL(url);

    return await new Promise((resolve, reject) => {
      const request = https.request({
        protocol: targetUrl.protocol,
        hostname: targetUrl.hostname,
        port: targetUrl.port || undefined,
        path: `${targetUrl.pathname}${targetUrl.search}`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
      }, response => {
        const chunks: Buffer[] = [];

        response.on('data', chunk => {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        });

        response.on('end', () => {
          const raw = Buffer.concat(chunks).toString('utf8');
          if (!raw) {
            resolve({
              status: response.statusCode ?? 0,
              ok: (response.statusCode ?? 0) >= 200 && (response.statusCode ?? 0) < 300,
              json: {},
            });
            return;
          }

          try {
            resolve({
              status: response.statusCode ?? 0,
              ok: (response.statusCode ?? 0) >= 200 && (response.statusCode ?? 0) < 300,
              json: JSON.parse(raw),
            });
          } catch (error) {
            reject(new Error(`Gemini Master TTS 응답 JSON 파싱 실패: ${raw.substring(0, 300)}`, { cause: error }));
          }
        });
      });

      request.setTimeout(this.requestTimeoutMs, () => {
        request.destroy(new Error(`Gemini Master TTS 요청 타임아웃 (${this.requestTimeoutMs}ms)`));
      });

      request.on('error', reject);
      request.write(body);
      request.end();
    });
  }

  getDescriptor(): MasterAudioGeneratorDescriptor {
    const descriptor: MasterAudioGeneratorDescriptor = {
      provider: 'gemini',
      modelName: this.modelName,
      voiceName: this.voiceName,
      styleVersion: this.styleVersion,
      promptHash: computeMasterAudioHash(this.prompt),
    };
    descriptor.temperature = this.temperature;
    if (typeof this.seed === 'number') {
      descriptor.seed = this.seed;
    }
    return descriptor;
  }

  async generate(script: string): Promise<AudioGenerateResult> {
    const url = `${this.baseUrl}/${this.modelName}:generateContent?key=${this.apiKey}`;
    const generationConfig: Record<string, unknown> = {
      responseModalities: ['AUDIO'],
      temperature: this.temperature,
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: {
            voiceName: this.voiceName,
          },
        },
      },
    };
    if (typeof this.seed === 'number') {
      generationConfig.seed = this.seed;
    }

    const payload = {
      contents: [{
        parts: [{
          text: `${this.prompt}\n\n原稿:\n${script}`,
        }],
      }],
      generationConfig,
    };

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      if (attempt === 1) {
        console.log(`[Gemini Master TTS] 마스터 오디오 생성 시도 (${this.modelName}, Voice: ${this.voiceName})...`);
      } else {
        const delay = this.baseDelayMs * Math.pow(2, attempt - 2);
        console.log(`  ⏳ 마스터 오디오 재시도 ${attempt}/${this.maxRetries} (${delay / 1000}초 대기 후)...`);
        await this.sleep(delay);
      }

      try {
        const response = await this.postJson(url, payload);
        const result = response.json;

        if (!response.ok) {
          if ((response.status === 429 || response.status >= 500) && attempt < this.maxRetries) {
            console.warn(`  ⚠️ Gemini Master TTS API 응답 ${response.status}, 재시도합니다...`);
            continue;
          }
          throw new Error(`Gemini Master TTS Error (${this.modelName}): ${response.status} - ${JSON.stringify(result)}`);
        }

        const audioPart = result?.candidates?.[0]?.content?.parts?.find((part: any) => part.inlineData);
        if (!audioPart?.inlineData?.data) {
          throw new Error(`마스터 오디오 데이터를 수신하지 못했습니다. 응답: ${JSON.stringify(result).substring(0, 200)}`);
        }

        const pcmBuffer = Buffer.from(audioPart.inlineData.data, 'base64');
        const { buffer, durationSec } = pcmToWav(pcmBuffer, this.audioConfig);
        console.log(`  ✅ 마스터 오디오 생성 완료 (${durationSec.toFixed(2)}초, Voice: ${this.voiceName}, temp: ${this.temperature})`);
        return { buffer, durationSec };
      } catch (error) {
        if (this.isRetryableError(error) && attempt < this.maxRetries) {
          console.warn(`  ⚠️ 마스터 오디오 생성 네트워크 에러, 재시도합니다... (${(error as Error).message})`);
          continue;
        }
        throw error;
      }
    }

    throw new Error(`Gemini Master TTS: ${this.maxRetries}회 재시도 후에도 실패`);
  }
}
