import * as https from 'https';
import { IAudioProvider, GenerateAudioOptions, AudioGenerateResult, AudioConfig } from '../../domain/interfaces/IAudioProvider';
import { pcmToWav } from './AudioUtils';

export class GeminiAudioProvider implements IAudioProvider {
  private apiKey: string;
  private modelName: string;
  private voice: string;
  private language: string;
  private prompt: string;
  private audioConfig: AudioConfig;
  private temperature: number;
  private seed?: number;
  private baseUrl = "https://generativelanguage.googleapis.com/v1beta/models";
  private readonly requestTimeoutMs = 2 * 60 * 1000;

  constructor(
    apiKey: string,
    modelName: string,
    voice: string,
    language: string,
    prompt: string,
    audioConfig: AudioConfig,
    temperature = 0,
    seed?: number,
  ) {
    this.apiKey = apiKey;
    this.modelName = modelName;
    this.voice = voice;
    this.language = language;
    this.prompt = prompt;
    this.audioConfig = audioConfig;
    this.temperature = temperature;
    this.seed = seed;
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
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
        family: 4,
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
            reject(new Error(`Gemini TTS 응답 JSON 파싱 실패: ${raw.substring(0, 300)}`, { cause: error }));
          }
        });
      });

      request.setTimeout(this.requestTimeoutMs, () => {
        request.destroy(new Error(`Gemini TTS 요청 타임아웃 (${this.requestTimeoutMs}ms)`));
      });

      request.on('error', reject);
      request.write(body);
      request.end();
    });
  }

  private isRetryableError(error: unknown): boolean {
    if (error instanceof Error) {
      const msg = error.message || '';
      const cause = (error as any).cause;
      const causeCode = cause?.code || '';
      return msg.includes('fetch failed')
        || msg.includes('timeout')
        || causeCode === 'ECONNRESET'
        || causeCode === 'ETIMEDOUT'
        || causeCode === 'ENOTFOUND'
        || msg.includes('network')
        || msg.includes('socket');
    }
    return false;
  }

  async generate(text: string, options: GenerateAudioOptions = {}): Promise<AudioGenerateResult> {
    const { scene_id } = options;
    const maxRetries = 3;
    const baseDelayMs = 2000;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      if (attempt === 1) {
        console.log(`[Gemini TTS] Scene ${scene_id || 'unknown'} 음성 생성 시도 (${this.modelName})...`);
      } else {
        const delay = baseDelayMs * Math.pow(2, attempt - 2);
        console.log(`  ⏳ Scene ${scene_id || 'unknown'} 재시도 ${attempt}/${maxRetries} (${delay / 1000}초 대기 후)...`);
        await this.sleep(delay);
      }

      const sanitizedText = text.length < 15 ? text + "..." : text;
      const url = `${this.baseUrl}/${this.modelName}:generateContent?key=${this.apiKey}`;

      const speechRate = this.audioConfig.speechRate;
      const paceInstruction = speechRate <= 0.8
        ? 'ゆっくり、はっきりと'
        : speechRate <= 0.9
          ? '落ち着いたペースで、丁寧に'
          : '自然なペースで';
      const instructionParts = [
        this.prompt,
        `${paceInstruction}、${this.language}で読み上げてください。`,
      ].filter(Boolean);
      const promptText = `${instructionParts.join(' ')}\n\n原稿:\n${sanitizedText}`;

      const payload = {
        contents: [{
          parts: [{ text: promptText }]
        }],
        generationConfig: {
          responseModalities: ["AUDIO"],
          temperature: this.temperature,
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: this.voice
              }
            }
          }
        }
      };
      if (typeof this.seed === 'number') {
        (payload.generationConfig as Record<string, unknown>).seed = this.seed;
      }

      try {
        const response = await this.postJson(url, payload);
        const result = response.json;

        if (!response.ok) {
          if (response.status === 404) {
             console.error(`  ⚠️ 모델 ${this.modelName}이 존재하지 않습니다. gemini-2.5-flash로 시도해보세요.`);
          }
          if (response.status === 429 || response.status >= 500) {
            if (attempt < maxRetries) {
              console.warn(`  ⚠️ API 응답 ${response.status}, 재시도합니다...`);
              continue;
            }
          }
          throw new Error(`Gemini API Error (${this.modelName}): ${response.status} - ${JSON.stringify(result)}`);
        }

        if (result.candidates && result.candidates[0].content.parts) {
          const audioPart = result.candidates[0].content.parts.find((p: any) => p.inlineData);
          if (audioPart) {
            const pcmBuffer = Buffer.from(audioPart.inlineData.data, 'base64');
            const { buffer, durationSec } = pcmToWav(pcmBuffer, this.audioConfig);
            console.log(`  ✅ 오디오 생성 완료 (${pcmBuffer.length} bytes, ${durationSec.toFixed(2)}초, Voice: ${this.voice}, temp: ${this.temperature})`);
            return { buffer, durationSec };
          }
        }

        throw new Error(`오디오 데이터를 수신하지 못했습니다. 응답: ${JSON.stringify(result).substring(0, 100)}`);
      } catch (error) {
        if (this.isRetryableError(error) && attempt < maxRetries) {
          console.warn(`  ⚠️ 네트워크 에러 발생, 재시도합니다... (${(error as Error).message})`);
          continue;
        }
        throw error;
      }
    }

    throw new Error(`Scene ${scene_id}: ${maxRetries}회 재시도 후에도 실패`);
  }
}
