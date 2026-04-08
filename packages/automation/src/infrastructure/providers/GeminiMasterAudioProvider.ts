import { AudioConfig, AudioGenerateResult } from '../../domain/interfaces/IAudioProvider';
import { IMasterAudioGenerator } from '../../domain/interfaces/IMasterAudioGenerator';
import { MasterAudioGeneratorDescriptor } from '../../domain/entities/MasterAudioManifest';
import { computeMasterAudioHash } from '../../domain/utils/MasterAudioUtils';
import { pcmToWav } from './AudioUtils';

export class GeminiMasterAudioProvider implements IMasterAudioGenerator {
  private readonly baseUrl = 'https://generativelanguage.googleapis.com/v1beta/models';

  constructor(
    private readonly apiKey: string,
    private readonly modelName: string,
    private readonly voiceName: string,
    private readonly styleVersion: string,
    private readonly prompt: string,
    private readonly audioConfig: AudioConfig,
    private readonly temperature: number,
    private readonly seed?: number,
  ) {}

  getDescriptor(): MasterAudioGeneratorDescriptor {
    const descriptor: MasterAudioGeneratorDescriptor = {
      provider: 'gemini',
      modelName: this.modelName,
      voiceName: this.voiceName,
      styleVersion: this.styleVersion,
      promptHash: computeMasterAudioHash(this.prompt),
    };
    descriptor.temperature = this.temperature;
    if (typeof this.seed === 'number') {
      descriptor.seed = this.seed;
    }
    return descriptor;
  }

  async generate(script: string): Promise<AudioGenerateResult> {
    console.log(`[Gemini Master TTS] 마스터 오디오 생성 시도 (${this.modelName}, Voice: ${this.voiceName})...`);
    const url = `${this.baseUrl}/${this.modelName}:generateContent?key=${this.apiKey}`;

    const generationConfig: Record<string, unknown> = {
      responseModalities: ['AUDIO'],
      temperature: this.temperature,
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: {
            voiceName: this.voiceName,
          },
        },
      },
    };
    if (typeof this.seed === 'number') {
      generationConfig.seed = this.seed;
    }

    const payload = {
      contents: [{
        parts: [{
          text: `${this.prompt}\n\n原稿:\n${script}`,
        }],
      }],
      generationConfig,
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const result = await response.json();

    if (!response.ok) {
      throw new Error(`Gemini Master TTS Error (${this.modelName}): ${response.status} - ${JSON.stringify(result)}`);
    }

    const audioPart = result?.candidates?.[0]?.content?.parts?.find((part: any) => part.inlineData);
    if (!audioPart?.inlineData?.data) {
      throw new Error(`마스터 오디오 데이터를 수신하지 못했습니다. 응답: ${JSON.stringify(result).substring(0, 200)}`);
    }

    const pcmBuffer = Buffer.from(audioPart.inlineData.data, 'base64');
    const { buffer, durationSec } = pcmToWav(pcmBuffer, this.audioConfig);
    console.log(`  ✅ 마스터 오디오 생성 완료 (${durationSec.toFixed(2)}초, Voice: ${this.voiceName}, temp: ${this.temperature})`);
    return { buffer, durationSec };
  }
}
