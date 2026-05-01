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

interface TailPaddingConfig {
  enabled: boolean;
  paddingMs: number;
}

interface HeadPaddingConfig {
  enabled: boolean;
  paddingMs: number;
}

export class ElevenLabsAudioProvider implements IAudioProvider {
  private readonly withTimestampsUrl = 'https://api.elevenlabs.io/v1/text-to-speech';

  /**
   * PCM 버퍼에서 [warmup speech → silence → narration onset] 전환점을 RMS 스캔으로 찾는다.
   * alignment 타임스탬프의 onset 지연 오차를 우회하기 위한 방법.
   *
   * searchFromSec: alignment 기반 나레이션 시작 추정치 (탐색 기준점)
   * 반환값: 나레이션 onset 바로 직전(80ms 앞)의 초 단위 trim 지점.
   *   - 일본어 파열음 자음(d/t/p/k) burst 는 40~60ms 지속이라 20ms 로는 burst 초반이 잘릴 수 있다.
   *     첫 글자의 consonant attack 이 통째로 확보되도록 80ms 로 공격적 pre-buffer 확보.
   */
  private findNarrationOnsetFromPcm(
    pcmBuffer: Buffer,
    audioConfig: AudioConfig,
    searchFromSec: number,
  ): number {
    const { sampleRate, channels, bitDepth } = audioConfig;
    const bytesPerFrame = channels * (bitDepth / 8);
    const bytesPerSec = sampleRate * bytesPerFrame;

    const WINDOW_SEC = 0.010;
    const windowFrames = Math.floor(sampleRate * WINDOW_SEC);
    const windowBytes = windowFrames * bytesPerFrame;
    const SILENCE_RMS = 400;
    const MIN_SILENCE_WINDOWS = 2; // 20ms 이상 무음이어야 gap으로 인정

    const searchStartByte = Math.max(
      0,
      Math.floor((searchFromSec - 0.400) * bytesPerSec / bytesPerFrame) * bytesPerFrame,
    );
    const searchEndByte = Math.min(
      pcmBuffer.length,
      Math.floor((searchFromSec + 0.200) * bytesPerSec / bytesPerFrame) * bytesPerFrame,
    );

    let silenceRun = 0;
    let foundSilence = false;

    for (let byteOffset = searchStartByte; byteOffset + windowBytes <= searchEndByte; byteOffset += windowBytes) {
      let sumSq = 0;
      for (let i = 0; i < windowFrames; i++) {
        const pos = byteOffset + i * bytesPerFrame;
        if (pos + 1 >= pcmBuffer.length) break;
        const sample = pcmBuffer.readInt16LE(pos);
        sumSq += sample * sample;
      }
      const rms = Math.sqrt(sumSq / windowFrames);

      if (rms < SILENCE_RMS) {
        silenceRun++;
        if (silenceRun >= MIN_SILENCE_WINDOWS) foundSilence = true;
      } else {
        if (foundSilence) {
          // 무음 이후 첫 speech 프레임 = narration onset
          // 80ms 앞당겨 pre-phoneme onset + consonant burst 전체 포함
          const onsetSec = byteOffset / bytesPerSec;
          return Math.max(0, onsetSec - 0.080);
        }
        silenceRun = 0;
      }
    }

    // warmup과 narration 사이 silence gap 미검출 → alignment 기반 fallback
    console.warn('  ⚠️ RMS 스캔으로 나레이션 onset 미검출 — alignment 기반 fallback (80ms pre-buffer) 사용');
    return Math.max(0, searchFromSec - 0.080);
  }

  constructor(
    private readonly apiKey: string,
    private readonly voiceId: string,
    private readonly modelId: string,
    private readonly languageCode: string,
    private readonly seed: number | undefined,
    private readonly voiceSettings: ElevenLabsVoiceSettings,
    private readonly audioConfig: AudioConfig,
    private readonly warmupPadding: WarmupPaddingConfig = { enabled: false, text: '', trimGuardMs: 0 },
    private readonly tailPadding: TailPaddingConfig = { enabled: true, paddingMs: 150 },
    private readonly headPadding: HeadPaddingConfig = { enabled: false, paddingMs: 0 },
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

            // trimGuardMs는 warmupEndSec fallback 경로에서만 사용.
            // narrationStartSec 경로는 RMS 스캔으로 실제 onset을 찾으므로 guard 불필요.
            const effectiveGuardMs = narrationStartSec !== undefined
              ? 0
              : this.warmupPadding.trimGuardMs;
            if (narrationStartSec !== undefined && this.warmupPadding.trimGuardMs !== 0) {
              console.warn(`  ⚠️ narrationStart 경로에서 trimGuardMs=${this.warmupPadding.trimGuardMs}ms 무시 (RMS 스캔 사용)`);
            }

            // narrationStartSec가 있으면 PCM RMS 스캔으로 실제 나레이션 onset을 검출.
            // alignment onset은 실제 acoustic onset보다 수십~100ms 늦게 보고되는 경향이
            // 있어 고정 pre-buffer로는 씬마다 다른 지연을 커버할 수 없음.
            const rawTrimSec = narrationStartSec !== undefined
              ? this.findNarrationOnsetFromPcm(pcmBuffer, this.audioConfig, narrationStartSec)
              : warmupEndSec;

            console.log(`  🔍 warmup 종료: ${warmupEndSec?.toFixed(3)}s, 나레이션 시작(alignment): ${narrationStartSec?.toFixed(3)}s → trim 기준(RMS): ${rawTrimSec?.toFixed(3)}s`);

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

        if (this.tailPadding.enabled) {
          if (!alignment || alignment.character_end_times_seconds.length === 0) {
            console.warn('  ⚠️ alignment 없음 — tail trim 불가');
          } else {
            const isPunctuation = (c: string) => /^[\s。、，．？！「」『』（）()\[\]【】〈〉《》\.,?!;:…‥・]+$/.test(c);
            let lastSpeechIdx = alignment.characters.length - 1;
            while (lastSpeechIdx >= 0 && isPunctuation(alignment.characters[lastSpeechIdx])) {
              lastSpeechIdx--;
            }

            if (lastSpeechIdx < 0) {
              console.warn('  ⚠️ 발화 가능 문자 없음 — tail trim 스킵');
            } else {
              const lastEndSec = alignment.character_end_times_seconds[lastSpeechIdx];
              const cutSec = lastEndSec + this.tailPadding.paddingMs / 1000;

              const { sampleRate, channels, bitDepth } = this.audioConfig;
              const bytesPerFrame = channels * (bitDepth / 8);
              const bytesPerSec = sampleRate * bytesPerFrame;
              const rawCutBytes = Math.floor(cutSec * bytesPerSec);
              const cutBytes = Math.floor(rawCutBytes / bytesPerFrame) * bytesPerFrame;

              if (cutBytes < pcmBuffer.length) {
                const removedBytes = pcmBuffer.length - cutBytes;
                const removedSec = removedBytes / bytesPerSec;
                pcmBuffer = pcmBuffer.slice(0, cutBytes);

                const keepCount = lastSpeechIdx + 1;
                const trimmedTailChars = alignment.characters.length - keepCount;
                const lastChar = alignment.characters[lastSpeechIdx];
                alignment = {
                  characters: alignment.characters.slice(0, keepCount),
                  character_start_times_seconds: alignment.character_start_times_seconds.slice(0, keepCount),
                  character_end_times_seconds: alignment.character_end_times_seconds.slice(0, keepCount),
                };
                console.log(`  ✂️  tail trim: ${removedSec.toFixed(3)}초 (${removedBytes}bytes) 제거 (last speech char '${lastChar}' end ${lastEndSec.toFixed(3)}s + padding ${this.tailPadding.paddingMs}ms, 꼬리 구두점 ${trimmedTailChars}자 제거)`);
              }
            }
          }
        }

        if (this.headPadding.enabled && this.headPadding.paddingMs > 0) {
          const { sampleRate, channels, bitDepth } = this.audioConfig;
          const bytesPerFrame = channels * (bitDepth / 8);
          const bytesPerSec = sampleRate * bytesPerFrame;
          const rawPadBytes = Math.floor((this.headPadding.paddingMs / 1000) * bytesPerSec);
          const padBytes = Math.floor(rawPadBytes / bytesPerFrame) * bytesPerFrame;
          if (padBytes > 0) {
            const silence = Buffer.alloc(padBytes);
            pcmBuffer = Buffer.concat([silence, pcmBuffer]);
            const shiftSec = padBytes / bytesPerSec;
            if (alignment) {
              alignment = {
                characters: alignment.characters,
                character_start_times_seconds: alignment.character_start_times_seconds.map(t => t + shiftSec),
                character_end_times_seconds: alignment.character_end_times_seconds.map(t => t + shiftSec),
              };
            }
            console.log(`  ➕ head padding: ${shiftSec.toFixed(3)}초 (${padBytes}bytes) 무음 prepend`);
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
