import * as crypto from 'crypto';
import * as fs from 'fs';
import { IAudioProvider, GenerateAudioOptions, AudioGenerateResult, AudioConfig } from '../../domain/interfaces/IAudioProvider';
import { PlaywrightSyncPoint } from '../../domain/entities/Lecture';
import { pcmToWav } from './AudioUtils';

export interface PhraseTiming {
  actionIndex: number;
  phrase: string;
  startMs: number;  // 해당 phrase 발화 시작 시각 (ms from scene start)
}

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
  private readonly beta1Url = 'https://texttospeech.googleapis.com/v1beta1/text:synthesize';

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

  /**
   * 나레이션 텍스트에 SSML <mark> 태그를 삽입하여 TTS를 생성하고,
   * 각 syncPoint phrase의 발화 시작 시각(ms)을 返한다.
   *
   * Google Cloud TTS v1beta1의 enableTimePointing을 사용.
   * 대상 보이스가 timepoints를 지원하지 않는 경우 문자수 비례 추산으로 폴백.
   */
  async generateWithTimings(
    narration: string,
    syncPoints: PlaywrightSyncPoint[],
    options: GenerateAudioOptions = {}
  ): Promise<{ durationSec: number; timings: PhraseTiming[] }> {
    const { scene_id } = options;

    // 1. SSML 생성: 각 syncPoint phrase 직전에 <mark> 삽입
    const ssml = buildSsmlWithMarks(narration, syncPoints);

    const { sampleRate, speechRate: speakingRate } = this.audioConfig;
    const payload = {
      input: { ssml },
      voice: { languageCode: this.languageCode, name: this.voiceName },
      audioConfig: {
        audioEncoding: 'LINEAR16',
        sampleRateHertz: sampleRate,
        speakingRate,
      },
      enableTimePointing: ['SSML_MARK'],
    };

    const token = await this.getAccessToken();
    console.log(`[Sync] Scene ${scene_id ?? '?'} SSML 타이밍 요청 중...`);

    const response = await fetch(this.beta1Url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify(payload),
    });

    const result = await response.json() as any;

    if (!response.ok) {
      console.warn(`  ⚠️ v1beta1 API 실패 (${response.status}), 문자수 추산으로 폴백합니다.`);
      return fallbackCharCountTimings(narration, syncPoints, options);
    }

    // 2. PCM → durationSec 계산 (오디오는 sync 용으로만 사용; 기존 WAV를 덮어쓰지 않는다)
    const pcmBuffer = Buffer.from(result.audioContent, 'base64');
    const { durationSec } = pcmToWav(pcmBuffer, this.audioConfig);

    // 3. timepoints 파싱
    const rawTimepoints: { markName: string; timeSeconds: number }[] = result.timepoints ?? [];

    if (rawTimepoints.length === 0) {
      console.warn(`  ⚠️ timepoints 없음 (보이스 미지원?), 문자수 추산으로 폴백합니다.`);
      return fallbackCharCountTimings(narration, syncPoints, options, durationSec);
    }

    // markName 형식: "sync-<actionIndex>"
    const timings: PhraseTiming[] = rawTimepoints.map(tp => {
      const actionIndex = parseInt(tp.markName.replace('sync-', ''), 10);
      const sp = syncPoints.find(s => s.actionIndex === actionIndex);
      return {
        actionIndex,
        phrase: sp?.phrase ?? '',
        startMs: Math.round(tp.timeSeconds * 1000),
      };
    });

    console.log(`  ✅ SSML 타이밍 취득 (${timings.length}개 마크, 총 ${durationSec.toFixed(2)}초)`);
    timings.forEach(t => console.log(`     action[${t.actionIndex}] "${t.phrase.slice(0, 15)}..." → ${t.startMs}ms`));

    return { durationSec, timings };
  }
}

// ---------------------------------------------------------------------------
// Helpers (module-level, not exported)
// ---------------------------------------------------------------------------

/** narration에 <mark> 태그를 삽입해 SSML을 構성한다. */
function buildSsmlWithMarks(narration: string, syncPoints: PlaywrightSyncPoint[]): string {
  // SSML 특수문자 이스케이프 (mark 삽입 전에 원본 텍스트에 적용)
  const escaped = narration
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // phrase 위치를 역순 정렬 → 뒤에서부터 삽입해야 인덱스가 밀리지 않는다
  const sorted = syncPoints
    .map(sp => ({ ...sp, pos: escaped.indexOf(sp.phrase) }))
    .filter(sp => sp.pos !== -1)
    .sort((a, b) => b.pos - a.pos);

  let text = escaped;
  for (const sp of sorted) {
    const mark = `<mark name="sync-${sp.actionIndex}"/>`;
    text = text.slice(0, sp.pos) + mark + text.slice(sp.pos);
  }

  return `<speak>${text}</speak>`;
}

/** 文字数比例による推算フォールバック */
async function fallbackCharCountTimings(
  narration: string,
  syncPoints: PlaywrightSyncPoint[],
  options: GenerateAudioOptions,
  durationSec?: number
): Promise<{ durationSec: number; timings: PhraseTiming[] }> {
  // durationSec が未知の場合は文字数から推算 (1秒≒5文字)
  const estimatedDuration = durationSec ?? narration.length / 5;
  const totalChars = narration.length;

  const timings: PhraseTiming[] = syncPoints
    .map(sp => {
      const pos = narration.indexOf(sp.phrase);
      if (pos === -1) {
        console.warn(`  ⚠️ phrase "${sp.phrase.slice(0, 20)}" が narration に見つかりません`);
        return null;
      }
      const startMs = Math.round((pos / totalChars) * estimatedDuration * 1000);
      return { actionIndex: sp.actionIndex, phrase: sp.phrase, startMs };
    })
    .filter((t): t is PhraseTiming => t !== null);

  console.log(`  [폴백] 문자수 추산 타이밍 (${timings.length}개)`);
  timings.forEach(t => console.log(`     action[${t.actionIndex}] "${t.phrase.slice(0, 15)}..." → ${t.startMs}ms (추산)`));

  return { durationSec: estimatedDuration, timings };
}
