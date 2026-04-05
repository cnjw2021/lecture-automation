import * as crypto from 'crypto';
import * as fs from 'fs';
import { IAudioProvider, GenerateAudioOptions, AudioGenerateResult } from '../../domain/interfaces/IAudioProvider';
import { config } from '../config';

interface ServiceAccountKey {
  client_email: string;
  private_key: string;
  token_uri: string;
  project_id: string;
}

export class GeminiCloudTtsProvider implements IAudioProvider {
  private serviceAccount: ServiceAccountKey;
  private modelName: string;
  private voiceName: string;
  private languageCode: string;
  private accessToken: string | null = null;
  private tokenExpiresAt = 0;
  private readonly baseUrl = 'https://texttospeech.googleapis.com/v1/text:synthesize';

  constructor(keyFilePath: string, modelName: string, voiceName: string, languageCode: string) {
    const raw = fs.readFileSync(keyFilePath, 'utf8');
    this.serviceAccount = JSON.parse(raw);
    this.modelName = modelName;
    this.voiceName = voiceName;
    this.languageCode = languageCode;
  }

  private createJwt(): string {
    const now = Math.floor(Date.now() / 1000);
    const header = { alg: 'RS256', typ: 'JWT' };
    const payload = {
      iss: this.serviceAccount.client_email,
      scope: 'https://www.googleapis.com/auth/cloud-platform',
      aud: this.serviceAccount.token_uri || 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    };

    const encode = (obj: object) =>
      Buffer.from(JSON.stringify(obj)).toString('base64url');

    const unsigned = `${encode(header)}.${encode(payload)}`;
    const sign = crypto.createSign('RSA-SHA256');
    sign.update(unsigned);
    const signature = sign.sign(this.serviceAccount.private_key, 'base64url');

    return `${unsigned}.${signature}`;
  }

  private async getAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiresAt) {
      return this.accessToken;
    }

    const jwt = this.createJwt();
    const tokenUri = this.serviceAccount.token_uri || 'https://oauth2.googleapis.com/token';

    const response = await fetch(tokenUri, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Access Token 발급 실패: ${response.status} - ${err}`);
    }

    const result = await response.json();
    this.accessToken = result.access_token;
    this.tokenExpiresAt = Date.now() + (result.expires_in - 60) * 1000;
    return this.accessToken!;
  }

  private pcmToWav(pcmData: Buffer, sampleRate: number): { buffer: Buffer; durationSec: number } {
    const channels = 1;
    const sampleWidth = 2;
    const dataSize = pcmData.length;
    const header = Buffer.alloc(44);

    header.write('RIFF', 0);
    header.writeUInt32LE(36 + dataSize, 4);
    header.write('WAVE', 8);
    header.write('fmt ', 12);
    header.writeUInt32LE(16, 16);
    header.writeUInt16LE(1, 20);
    header.writeUInt16LE(channels, 22);
    header.writeUInt32LE(sampleRate, 24);
    header.writeUInt32LE(sampleRate * channels * sampleWidth, 28);
    header.writeUInt16LE(channels * sampleWidth, 32);
    header.writeUInt16LE(sampleWidth * 8, 34);
    header.write('data', 36);
    header.writeUInt32LE(dataSize, 40);

    const buffer = Buffer.concat([header, pcmData]);
    const durationSec = dataSize / (sampleRate * channels * sampleWidth);
    return { buffer, durationSec };
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private isRetryableError(error: unknown): boolean {
    if (error instanceof Error) {
      const msg = error.message || '';
      const cause = (error as any).cause;
      const causeCode = cause?.code || '';
      return msg.includes('fetch failed')
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

    const videoConfig = config.getVideoConfig();
    const sampleRate = videoConfig.audio?.sampleRate || 24000;
    const ttsConfig = config.getTtsConfig();
    const speechRate = ttsConfig.speechRate || 0.85;

    const paceInstruction = speechRate <= 0.7
      ? 'ゆっくり、はっきりと読み上げてください。'
      : speechRate <= 0.85
        ? '落ち着いたペースで、丁寧に読み上げてください。'
        : '自然なペースで読み上げてください。';

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      if (attempt === 1) {
        console.log(`[Gemini Cloud TTS] Scene ${scene_id || 'unknown'} 음성 생성 시도 (${this.modelName}, Voice: ${this.voiceName})...`);
      } else {
        const delay = baseDelayMs * Math.pow(2, attempt - 2);
        console.log(`  ⏳ Scene ${scene_id || 'unknown'} 재시도 ${attempt}/${maxRetries} (${delay / 1000}초 대기 후)...`);
        await this.sleep(delay);
      }

      const payload = {
        input: {
          text,
          prompt: paceInstruction,
        },
        voice: {
          languageCode: this.languageCode,
          name: this.voiceName,
          model_name: this.modelName,
        },
        audioConfig: {
          audioEncoding: 'LINEAR16',
          sampleRateHertz: sampleRate,
        },
      };

      try {
        const token = await this.getAccessToken();
        const response = await fetch(this.baseUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        });

        const result = await response.json();

        if (!response.ok) {
          if (response.status === 401) {
            this.accessToken = null;
          }
          if ((response.status === 429 || response.status >= 500 || response.status === 401) && attempt < maxRetries) {
            console.warn(`  ⚠️ API 응답 ${response.status}, 재시도합니다...`);
            continue;
          }
          throw new Error(`Gemini Cloud TTS Error: ${response.status} - ${JSON.stringify(result)}`);
        }

        if (!result.audioContent) {
          throw new Error(`오디오 데이터를 수신하지 못했습니다. 응답: ${JSON.stringify(result).substring(0, 100)}`);
        }

        const pcmBuffer = Buffer.from(result.audioContent, 'base64');
        const { buffer, durationSec } = this.pcmToWav(pcmBuffer, sampleRate);
        console.log(`  ✅ 오디오 생성 완료 (${pcmBuffer.length} bytes, ${durationSec.toFixed(2)}초, Model: ${this.modelName}, Voice: ${this.voiceName})`);
        return { buffer, durationSec };
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
