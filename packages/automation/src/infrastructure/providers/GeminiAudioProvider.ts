import { IAudioProvider, GenerateAudioOptions, AudioGenerateResult, AudioConfig } from '../../domain/interfaces/IAudioProvider';

export class GeminiAudioProvider implements IAudioProvider {
  private apiKey: string;
  private modelName: string;
  private voice: string;
  private language: string;
  private audioConfig: AudioConfig;
  private baseUrl = "https://generativelanguage.googleapis.com/v1beta/models";

  constructor(apiKey: string, modelName: string, voice: string, language: string, audioConfig: AudioConfig) {
    this.apiKey = apiKey;
    this.modelName = modelName;
    this.voice = voice;
    this.language = language;
    this.audioConfig = audioConfig;
  }

  private pcmToWav(pcmData: Buffer): { buffer: Buffer, durationSec: number } {
    const { sampleRate, channels, bitDepth } = this.audioConfig;
    const sampleWidth = bitDepth / 8;
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

      const payload = {
        contents: [{
          parts: [{ text: `${paceInstruction}、${this.language}で読み上げてください: ` + sanitizedText }]
        }],
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: this.voice
              }
            }
          }
        }
      };

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        const result = await response.json();

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
            const { buffer, durationSec } = this.pcmToWav(pcmBuffer);
            console.log(`  ✅ 오디오 생성 완료 (${pcmBuffer.length} bytes, ${durationSec.toFixed(2)}초, Voice: ${this.voice})`);
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
