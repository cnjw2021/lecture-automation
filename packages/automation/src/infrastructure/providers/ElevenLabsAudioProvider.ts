import { AudioConfig, AudioAlignment, AudioGenerateResult, GenerateAudioOptions, IAudioProvider } from '../../domain/interfaces/IAudioProvider';
import { pcmToWav } from './AudioUtils';

interface ElevenLabsVoiceSettings {
  stability?: number;
  similarity_boost?: number;
  style?: number;
  use_speaker_boost?: boolean;
  speed?: number;
}

export class ElevenLabsAudioProvider implements IAudioProvider {
  private readonly baseUrl = 'https://api.elevenlabs.io/v1/text-to-speech';
  private readonly withTimestampsUrl = 'https://api.elevenlabs.io/v1/text-to-speech';

  constructor(
    private readonly apiKey: string,
    private readonly voiceId: string,
    private readonly modelId: string,
    private readonly languageCode: string,
    private readonly seed: number | undefined,
    private readonly voiceSettings: ElevenLabsVoiceSettings,
    private readonly audioConfig: AudioConfig,
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

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      if (attempt === 1) {
        console.log(`[ElevenLabs TTS] Scene ${scene_id || 'unknown'} 음성 생성 시도 (${this.modelId})...`);
      } else {
        const delay = baseDelayMs * Math.pow(2, attempt - 2);
        console.log(`  ⏳ Scene ${scene_id || 'unknown'} 재시도 ${attempt}/${maxRetries} (${delay / 1000}초 대기 후)...`);
        await this.sleep(delay);
      }

      const payload: Record<string, unknown> = {
        text,
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

        const pcmBuffer = Buffer.from(json.audio_base64, 'base64');
        const { buffer, durationSec } = pcmToWav(pcmBuffer, this.audioConfig);

        let alignment: AudioAlignment | undefined;
        if (json.alignment) {
          alignment = json.alignment;
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
