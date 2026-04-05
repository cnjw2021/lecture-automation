import * as crypto from 'crypto';
import * as fs from 'fs';
import { IAudioProvider, GenerateAudioOptions, AudioGenerateResult, AudioConfig } from '../../domain/interfaces/IAudioProvider';
import { pcmToWav } from './AudioUtils';

interface ServiceAccountKey {
  client_email: string;
  private_key: string;
  token_uri: string;
}

export class GoogleCloudTtsProvider implements IAudioProvider {
  private serviceAccount: ServiceAccountKey;
  private voiceName: string;
  private languageCode: string;
  private audioConfig: AudioConfig;
  private accessToken: string | null = null;
  private tokenExpiresAt = 0;
  private readonly baseUrl = 'https://texttospeech.googleapis.com/v1/text:synthesize';

  constructor(keyFilePath: string, voiceName: string, languageCode: string, audioConfig: AudioConfig) {
    const raw = fs.readFileSync(keyFilePath, 'utf8');
    this.serviceAccount = JSON.parse(raw);
    this.voiceName = voiceName;
    this.languageCode = languageCode;
    this.audioConfig = audioConfig;
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

    const { sampleRate, speechRate: speakingRate } = this.audioConfig;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      if (attempt === 1) {
        console.log(`[Google Cloud TTS] Scene ${scene_id || 'unknown'} 음성 생성 시도 (${this.voiceName})...`);
      } else {
        const delay = baseDelayMs * Math.pow(2, attempt - 2);
        console.log(`  ⏳ Scene ${scene_id || 'unknown'} 재시도 ${attempt}/${maxRetries} (${delay / 1000}초 대기 후)...`);
        await this.sleep(delay);
      }

      const payload = {
        input: { text },
        voice: {
          languageCode: this.languageCode,
          name: this.voiceName,
        },
        audioConfig: {
          audioEncoding: 'LINEAR16',
          sampleRateHertz: sampleRate,
          speakingRate,
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
          throw new Error(`Google Cloud TTS Error: ${response.status} - ${JSON.stringify(result)}`);
        }

        if (!result.audioContent) {
          throw new Error(`오디오 데이터를 수신하지 못했습니다. 응답: ${JSON.stringify(result).substring(0, 100)}`);
        }

        const pcmBuffer = Buffer.from(result.audioContent, 'base64');
        const { buffer, durationSec } = pcmToWav(pcmBuffer, this.audioConfig);
        console.log(`  ✅ 오디오 생성 완료 (${pcmBuffer.length} bytes, ${durationSec.toFixed(2)}초, Voice: ${this.voiceName})`);
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
