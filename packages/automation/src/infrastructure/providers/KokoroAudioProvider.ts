import {
  AudioConfig,
  AudioGenerateResult,
  GenerateAudioOptions,
  IAudioProvider,
} from '../../domain/interfaces/IAudioProvider';
import { PythonTtsBridge } from './PythonTtsBridge';

export interface KokoroProviderConfig {
  voice: string;
  modelPath: string;
  voicesPath: string;
  speed: number;
  g2pMode: 'auto' | 'direct' | 'phoneme';
}

export class KokoroAudioProvider implements IAudioProvider {
  private readonly bridge: PythonTtsBridge;

  constructor(
    private readonly providerConfig: KokoroProviderConfig,
    audioConfig: AudioConfig,
    workspaceRoot: string,
  ) {
    this.bridge = new PythonTtsBridge({
      engine: 'kokoro',
      workspaceRoot,
      audioConfig,
    });
  }

  async generate(text: string, options: GenerateAudioOptions = {}): Promise<AudioGenerateResult> {
    const sceneLabel = options.scene_id ?? 'unknown';
    console.log(`[Kokoro TTS] Scene ${sceneLabel} 음성 생성 (voice=${this.providerConfig.voice}, g2p=${this.providerConfig.g2pMode})...`);
    const result = await this.bridge.synthesize({
      text,
      voice: this.providerConfig.voice,
      engineParams: {
        modelPath: this.providerConfig.modelPath,
        voicesPath: this.providerConfig.voicesPath,
        speed: this.providerConfig.speed,
        g2pMode: this.providerConfig.g2pMode,
      },
    });
    console.log(`  ✅ Kokoro 합성 완료 (${result.durationSec.toFixed(2)}초)`);
    return result;
  }
}
