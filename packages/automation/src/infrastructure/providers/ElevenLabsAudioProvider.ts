import { AudioConfig, AudioAlignment, AudioGenerateResult, GenerateAudioOptions, IAudioProvider } from '../../domain/interfaces/IAudioProvider';
import { pcmToWav } from './AudioUtils';

interface ElevenLabsVoiceSettings {
  stability?: number;
  similarity_boost?: number;
  style?: number;
  use_speaker_boost?: boolean;
  speed?: number;
}

interface WarmupPaddingConfig {
  enabled: boolean;
  text: string;
  trimGuardMs: number;
}

export class ElevenLabsAudioProvider implements IAudioProvider {
  private readonly withTimestampsUrl = 'https://api.elevenlabs.io/v1/text-to-speech';

  constructor(
    private readonly apiKey: string,
    private readonly voiceId: string,
    private readonly modelId: string,
    private readonly languageCode: string,
    private readonly seed: number | undefined,
    private readonly voiceSettings: ElevenLabsVoiceSettings,
    private readonly audioConfig: AudioConfig,
    private readonly warmupPadding: WarmupPaddingConfig = { enabled: false, text: '', trimGuardMs: 0 },
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
      || msg.includes('timeout')
      || msg.includes('network')
      || msg.includes('socket')
      || causeCode === 'ECONNRESET'
      || causeCode === 'ETIMEDOUT'
      || causeCode === 'ENOTFOUND';
  }

  async generate(text: string, options: GenerateAudioOptions = {}): Promise<AudioGenerateResult> {
    const { scene_id } = options;
    const maxRetries = 3;
    const baseDelayMs = 2000;
    const outputFormat = `pcm_${this.audioConfig.sampleRate}`;

    const useWarmup = this.warmupPadding.enabled && this.warmupPadding.text.length > 0;
    const warmupChars = useWarmup ? this.warmupPadding.text.length : 0;
    const sentText = useWarmup ? this.warmupPadding.text + text : text;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      if (attempt === 1) {
        console.log(`[ElevenLabs TTS] Scene ${scene_id || 'unknown'} 음성 생성 시도 (${this.modelId})${useWarmup ? ' [warmup]' : ''}...`);
      } else {
        const delay = baseDelayMs * Math.pow(2, attempt - 2);
        console.log(`  ⏳ Scene ${scene_id || 'unknown'} 재시도 ${attempt}/${maxRetries} (${delay / 1000}초 대기 후)...`);
        await this.sleep(delay);
      }

      const payload: Record<string, unknown> = {
        text: sentText,
        model_id: this.modelId,
        language_code: this.languageCode,
        voice_settings: this.voiceSettings,
      };

      if (typeof this.seed === 'number') {
        payload.seed = this.seed;
      }

      try {
        // with-timestamps 엔드포인트: JSON 응답으로 오디오 + 문자 단위 타임스탬프
        const url = `${this.withTimestampsUrl}/${this.voiceId}/with-timestamps?output_format=${outputFormat}`;
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'xi-api-key': this.apiKey,
          },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const errorText = await response.text();
          if ((response.status === 429 || response.status >= 500) && attempt < maxRetries) {
            console.warn(`  ⚠️ API 응답 ${response.status}, 재시도합니다...`);
            continue;
          }
          throw new Error(`ElevenLabs TTS Error (${this.modelId}): ${response.status} - ${errorText}`);
        }

        const json = await response.json() as {
          audio_base64: string;
          alignment?: {
            characters: string[];
            character_start_times_seconds: number[];
            character_end_times_seconds: number[];
          };
        };

        let pcmBuffer = Buffer.from(json.audio_base64, 'base64');
        let alignment: AudioAlignment | undefined = json.alignment;

        if (this.warmupPadding.enabled && warmupChars > 0) {
          if (!alignment) {
            console.warn(`  ⚠️ alignment 누락 — warmup trim 불가, warmup 포함된 채로 반환`);
          } else {
            const endTimes = alignment.character_end_times_seconds;
            const startTimes = alignment.character_start_times_seconds;
            const warmupEndSec = endTimes[warmupChars - 1];
            const narrationStartSec = startTimes[warmupChars];

            // narrationStartSec 경로: 나레이션 첫 글자 시작 시점이 기준이므로
            // trimGuardMs를 더하면 나레이션을 침범하게 됨 → 0으로 강제.
            // warmupEndSec fallback 경로: 기존 동작(trimGuardMs 적용)을 유지.
            let effectiveGuardMs = this.warmupPadding.trimGuardMs;
            if (narrationStartSec !== undefined && effectiveGuardMs !== 0) {
              console.warn(`  ⚠️ narrationStart 기준 trim에서 trimGuardMs=${effectiveGuardMs}ms는 나레이션 클리핑을 유발합니다 — 0으로 강제 적용`);
              effectiveGuardMs = 0;
            }

            // ElevenLabs alignment의 character_start_times_seconds는 실제 음성
            // acoustic onset보다 수십ms 늦게 찍히는 경향이 있음.
            // narrationStartSec에서 PRE_BUFFER_SEC만큼 앞당겨 잘라 onset 클리핑 방지.
            // 해당 구간은 warmup 마지막(。)의 무음/여운이므로 포함해도 무해.
            const PRE_BUFFER_SEC = 0.050;
            const rawTrimSec = narrationStartSec !== undefined
              ? Math.max(0, narrationStartSec - PRE_BUFFER_SEC)
              : warmupEndSec;

            console.log(`  🔍 warmup 종료: ${warmupEndSec?.toFixed(3)}s, 나레이션 시작: ${narrationStartSec?.toFixed(3)}s → trim 기준: ${rawTrimSec?.toFixed(3)}s (guard: ${effectiveGuardMs}ms)`);

            if (rawTrimSec === undefined || rawTrimSec <= 0) {
              console.warn(`  ⚠️ warmup trim 경계 이상 (trimSec=${rawTrimSec}) — trim 생략`);
            } else {
              const trimSec = rawTrimSec + effectiveGuardMs / 1000;
              const { sampleRate, channels, bitDepth } = this.audioConfig;
              const bytesPerFrame = channels * (bitDepth / 8);
              const bytesPerSec = sampleRate * bytesPerFrame;
              const rawTrimBytes = Math.floor(trimSec * bytesPerSec);
              const trimBytes = Math.floor(rawTrimBytes / bytesPerFrame) * bytesPerFrame;

              const totalBytes = pcmBuffer.length;
              if (trimBytes >= totalBytes) {
                throw new Error(`ElevenLabs warmup trim 이상: trimBytes(${trimBytes}) >= pcmBuffer(${totalBytes}). warmup 텍스트가 너무 길거나 alignment 오염`);
              }

              pcmBuffer = pcmBuffer.slice(trimBytes);

              alignment = {
                characters: alignment.characters.slice(warmupChars),
                character_start_times_seconds: alignment.character_start_times_seconds.slice(warmupChars).map(t => t - trimSec),
                character_end_times_seconds: alignment.character_end_times_seconds.slice(warmupChars).map(t => t - trimSec),
              };

              console.log(`  ✂️  warmup trim: ${trimSec.toFixed(3)}초 (${trimBytes}bytes) 제거`);
            }
          }
        }

        const { buffer, durationSec } = pcmToWav(pcmBuffer, this.audioConfig);

        if (alignment) {
          console.log(`  ✅ 오디오 생성 완료 (${pcmBuffer.length} bytes, ${durationSec.toFixed(2)}초, alignment: ${alignment.characters.length}자)`);
        } else {
          console.log(`  ✅ 오디오 생성 완료 (${pcmBuffer.length} bytes, ${durationSec.toFixed(2)}초, alignment 없음)`);
        }
        return { buffer, durationSec, alignment };
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
