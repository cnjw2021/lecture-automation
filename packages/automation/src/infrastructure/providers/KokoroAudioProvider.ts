import * as path from 'path';
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
    private readonly workspaceRoot: string,
  ) {
    this.bridge = new PythonTtsBridge({
      engine: 'kokoro',
      workspaceRoot,
      audioConfig,
    });
  }

  /** config/tts.json 의 상대경로는 프로젝트 루트 기준이므로 synth.py 에 절대경로로 전달한다. */
  private toAbsolute(p: string): string {
    return path.isAbsolute(p) ? p : path.resolve(this.workspaceRoot, p);
  }

  async generate(text: string, options: GenerateAudioOptions = {}): Promise<AudioGenerateResult> {
    const sceneLabel = options.scene_id ?? 'unknown';
    console.log(`[Kokoro TTS] Scene ${sceneLabel} 음성 생성 (voice=${this.providerConfig.voice}, g2p=${this.providerConfig.g2pMode})...`);
    const result = await this.bridge.synthesize({
      text,
      voice: this.providerConfig.voice,
      engineParams: {
        modelPath: this.toAbsolute(this.providerConfig.modelPath),
        voicesPath: this.toAbsolute(this.providerConfig.voicesPath),
        speed: this.providerConfig.speed,
        g2pMode: this.providerConfig.g2pMode,
      },
    });
    console.log(`  ✅ Kokoro 합성 완료 (${result.durationSec.toFixed(2)}초)`);
    return result;
  }
}
