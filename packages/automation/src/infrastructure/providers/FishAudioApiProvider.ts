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

export interface FishAudioPreflightConfig {
  enabled: boolean;
  text: string;
}

export interface FishAudioApiProviderConfig {
  apiKey: string;
  voiceId: string;
  modelName: string;
  temperature: number;
  topP: number;
  speed: number;
  normalize: boolean;
  preflight: FishAudioPreflightConfig;
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

  /**
   * Fish Audio 의 첫 generation prosody drift 우회용 워밍업 호출.
   * 동일 voice 로 짧은 텍스트를 합성 요청하고 응답은 폐기한다.
   * 네트워크 에러·서버 에러도 throw 하지 않고 경고만 — 본 요청 흐름을 막지 않는다.
   * 응답 body 는 명시적으로 소비해 connection 누수 방지.
   */
  private async runPreflight(): Promise<void> {
    const text = this.providerConfig.preflight.text;
    if (!text) return;

    const startedAt = Date.now();
    console.log(`[Fish Audio API] Scene 1 preflight (워밍업, 응답 폐기)...`);

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

    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.providerConfig.apiKey}`,
          'Content-Type': 'application/json',
          model: this.providerConfig.modelName,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const status = response.status;
        // 본문 소비 (connection release)
        try { await response.arrayBuffer(); } catch { /* noop */ }
        console.warn(`  ⚠️ preflight 응답 ${status} — 본 요청 계속 진행`);
        return;
      }
      // 워밍업 목적이므로 응답 audio 는 폐기. 단 connection release 위해 본문은 소비.
      await response.arrayBuffer();
      const elapsed = Date.now() - startedAt;
      console.log(`  ✅ preflight 완료 (${elapsed}ms)`);
    } catch (err) {
      console.warn(`  ⚠️ preflight 네트워크 에러 — 본 요청 계속 진행: ${(err as Error).message}`);
    }
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

    // 강의 첫 씬 (scene_id === 1) 의 prosody drift (영미권 억양) 완화:
    // 같은 voice 로 가짜 요청을 한 번 보내 서버측 캐시·embedding 을 워밍업한 뒤
    // 본 요청을 보낸다. Fish Audio 의 cross-scene timbre 일관성 관찰 (씬 2~ 가 안정적)
    // 으로 미루어 첫 요청이 일종의 warm-up 역할을 하고 있다는 가설 기반.
    // 실패해도 본 요청은 계속 진행 (best-effort).
    if (this.providerConfig.preflight.enabled && options.scene_id === 1) {
      await this.runPreflight();
    }

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
   * 표준 WAV 헤더 보장 (`-map_metadata -1` + `-bitexact`):
   *   ffmpeg 는 기본적으로 fmt 와 data 사이에 LIST/INFO 청크 (인코더 정보 등) 를
   *   삽입한다. 이 메타데이터 청크가 들어가면 헤더가 44 바이트를 초과해 후속
   *   WavChunkAssembler 가 `subarray(44)` 로 PCM 만 추출한다는 가정과 어긋나
   *   LIST 바이트가 audio 로 새어 들어가 씬 경계에서 노이즈가 발생한다.
   *   ElevenLabs / Gemini 의 AudioUtils.pcmToWav 는 표준 44 바이트 헤더만 쓰므로
   *   문제 없음. Fish Audio 도 동일 contract 를 따르도록 두 플래그 모두 적용:
   *   - `-map_metadata -1`: 입력측 메타데이터 mapping 비활성
   *   - `-bitexact`: WAV muxer 의 인코더 자동 삽입 LIST 청크 차단
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
          '-map_metadata', '-1',
          '-bitexact',
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
