import { spawn } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  AudioConfig,
  AudioGenerateResult,
  GenerateAudioOptions,
  IAudioProvider,
} from '../../domain/interfaces/IAudioProvider';

export interface FishAudioApiProviderConfig {
  apiKey: string;
  voiceId: string;
  modelName: string;
  temperature: number;
  topP: number;
  speed: number;
  normalize: boolean;
}

/**
 * Fish Audio cloud TTS API provider (https://fish.audio/).
 *
 * 본 프로젝트는 OSS Fish Speech 1.5 self-host 가 NC 라이선스 (CC-BY-NC-SA-4.0) 로
 * 상업 사용 불가 → fish.audio 의 유료 API (Plus/Pro/Max, 商用利用可能 명시) 를
 * 사용하는 경로다.
 *
 * 응답 오디오는 Fish Audio 의 native 샘플레이트 (보통 44.1kHz) 라 프로젝트 표준
 * (config/video.json: 24kHz mono 16-bit) 과 다르므로 ffmpeg 로 정규화한다.
 */
export class FishAudioApiProvider implements IAudioProvider {
  private readonly endpoint = 'https://api.fish.audio/v1/tts';

  constructor(
    private readonly providerConfig: FishAudioApiProviderConfig,
    private readonly audioConfig: AudioConfig,
  ) {}

  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private isRetryableError(err: unknown): boolean {
    if (!(err instanceof Error)) return false;
    const msg = err.message || '';
    const cause = (err as Error & { cause?: { code?: string } }).cause;
    const code = cause?.code || '';
    return msg.includes('fetch failed')
      || msg.includes('timeout')
      || msg.includes('socket hang up')
      || code === 'ECONNRESET'
      || code === 'ETIMEDOUT'
      || code === 'ENOTFOUND';
  }

  async generate(text: string, options: GenerateAudioOptions = {}): Promise<AudioGenerateResult> {
    const sceneLabel = options.scene_id ?? 'unknown';
    const maxRetries = 3;
    const baseDelayMs = 2000;

    const payload = {
      text,
      reference_id: this.providerConfig.voiceId,
      format: 'wav',
      normalize: this.providerConfig.normalize,
      latency: 'normal',
      temperature: this.providerConfig.temperature,
      top_p: this.providerConfig.topP,
      prosody: {
        speed: this.providerConfig.speed,
        volume: 0,
      },
    };

    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      if (attempt === 1) {
        console.log(
          `[Fish Audio API] Scene ${sceneLabel} 음성 생성 (model=${this.providerConfig.modelName}, voice=${this.providerConfig.voiceId})...`,
        );
      } else {
        const delay = baseDelayMs * Math.pow(2, attempt - 2);
        console.log(`  ⏳ Scene ${sceneLabel} 재시도 ${attempt}/${maxRetries} (${delay / 1000}초 대기 후)...`);
        await this.sleep(delay);
      }

      try {
        const response = await fetch(this.endpoint, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.providerConfig.apiKey}`,
            'Content-Type': 'application/json',
            // Fish Audio 는 model 을 헤더로 전달
            model: this.providerConfig.modelName,
          },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const errorText = await response.text();
          if ((response.status === 429 || response.status >= 500) && attempt < maxRetries) {
            console.warn(`  ⚠️ Fish Audio API ${response.status}, 재시도합니다...`);
            lastError = new Error(`Fish Audio API ${response.status}: ${errorText}`);
            continue;
          }
          throw new Error(`Fish Audio API ${response.status}: ${errorText}`);
        }

        const rawWav = Buffer.from(await response.arrayBuffer());
        const normalized = await this.normalizeAudio(rawWav);
        const durationSec = this.computeDurationFromWav(normalized);

        console.log(`  ✅ Fish Audio 합성 완료 (${normalized.length} bytes, ${durationSec.toFixed(2)}초)`);
        return { buffer: normalized, durationSec };
      } catch (err) {
        lastError = err as Error;
        if (this.isRetryableError(err) && attempt < maxRetries) {
          console.warn(`  ⚠️ 네트워크 에러 발생, 재시도합니다... (${(err as Error).message})`);
          continue;
        }
        throw err;
      }
    }

    throw lastError ?? new Error(`Fish Audio API: ${maxRetries}회 재시도 후 실패`);
  }

  /**
   * Fish Audio 응답을 프로젝트 표준 (24kHz mono 16-bit PCM WAV) 으로 ffmpeg 정규화.
   * 입력이 이미 동일 형식이어도 무해하게 통과한다.
   *
   * Click 방지: 시작과 끝 모두 15ms 선형 램프 적용.
   * - 시작 fade-in: 단독 재생 시 첫 샘플 비제로로 인한 click 제거
   * - 끝 fade-out: 씬 concat 시 boundary 의 amplitude 단차 제거
   *   (씬 N 의 마지막 비제로 샘플 → 씬 N+1 의 fade-in 시작 0 사이의 step click)
   *
   * areverse 트릭: 시작 fade-in 적용 → 반전 → 다시 시작 fade-in (반전 상태에선 끝)
   * → 다시 반전. 단일 ffmpeg 패스로 양쪽 fade 처리 가능. 입력 길이를 미리 알 필요 없음.
   */
  private async normalizeAudio(input: Buffer): Promise<Buffer> {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fish-audio-'));
    const inPath = path.join(tmpDir, 'in.wav');
    const outPath = path.join(tmpDir, 'out.wav');

    try {
      fs.writeFileSync(inPath, input);

      await new Promise<void>((resolve, reject) => {
        const child = spawn('ffmpeg', [
          '-y',
          '-loglevel', 'error',
          '-i', inPath,
          '-ar', String(this.audioConfig.sampleRate),
          '-ac', String(this.audioConfig.channels),
          '-af', 'afade=t=in:st=0:d=0.015,areverse,afade=t=in:st=0:d=0.015,areverse',
          '-acodec', 'pcm_s16le',
          outPath,
        ]);
        let stderrBuf = '';
        child.stderr.on('data', chunk => {
          stderrBuf += chunk.toString();
        });
        child.on('error', reject);
        child.on('close', code => {
          if (code === 0) resolve();
          else reject(new Error(`ffmpeg 종료 코드 ${code}\nstderr: ${stderrBuf}`));
        });
      });

      return fs.readFileSync(outPath);
    } finally {
      try {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      } catch {
        /* noop */
      }
    }
  }

  private computeDurationFromWav(wav: Buffer): number {
    if (wav.length < 44 || wav.toString('ascii', 0, 4) !== 'RIFF') return 0;
    const sampleRate = wav.readUInt32LE(24);
    const channels = wav.readUInt16LE(22);
    const bitDepth = wav.readUInt16LE(34);
    const dataSize = wav.readUInt32LE(40);
    const bytesPerSec = sampleRate * channels * (bitDepth / 8);
    return bytesPerSec > 0 ? dataSize / bytesPerSec : 0;
  }
}
