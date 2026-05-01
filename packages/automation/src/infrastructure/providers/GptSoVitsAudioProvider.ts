import {
  AudioConfig,
  AudioGenerateResult,
  GenerateAudioOptions,
  IAudioProvider,
} from '../../domain/interfaces/IAudioProvider';
import { PythonTtsBridge } from './PythonTtsBridge';

export interface GptSoVitsProviderConfig {
  repoPath: string;
  gptModelPath: string;
  sovitsModelPath: string;
  refWavPath: string;
  refText: string;
  refLanguage: string;
  targetLanguage: string;
  topK: number;
  topP: number;
  temperature: number;
  speed: number;
}

export class GptSoVitsAudioProvider implements IAudioProvider {
  private readonly bridge: PythonTtsBridge;

  constructor(
    private readonly providerConfig: GptSoVitsProviderConfig,
    audioConfig: AudioConfig,
    workspaceRoot: string,
  ) {
    this.bridge = new PythonTtsBridge({
      engine: 'gpt-sovits',
      workspaceRoot,
      audioConfig,
      pythonTimeoutMs: 15 * 60 * 1000,
    });
  }

  async generate(text: string, options: GenerateAudioOptions = {}): Promise<AudioGenerateResult> {
    const sceneLabel = options.scene_id ?? 'unknown';
    console.log(`[GPT-SoVITS] Scene ${sceneLabel} 음성 생성 (target=${this.providerConfig.targetLanguage})...`);
    const result = await this.bridge.synthesize({
      text,
      voice: this.providerConfig.refWavPath,
      engineParams: {
        repoPath: this.providerConfig.repoPath,
        gptModelPath: this.providerConfig.gptModelPath,
        sovitsModelPath: this.providerConfig.sovitsModelPath,
        refWavPath: this.providerConfig.refWavPath,
        refText: this.providerConfig.refText,
        refLanguage: this.providerConfig.refLanguage,
        targetLanguage: this.providerConfig.targetLanguage,
        topK: this.providerConfig.topK,
        topP: this.providerConfig.topP,
        temperature: this.providerConfig.temperature,
        speed: this.providerConfig.speed,
      },
    });
    console.log(`  ✅ GPT-SoVITS 합성 완료 (${result.durationSec.toFixed(2)}초)`);
    return result;
  }
}
