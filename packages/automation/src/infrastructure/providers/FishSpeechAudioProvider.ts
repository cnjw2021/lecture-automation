import {
  AudioConfig,
  AudioGenerateResult,
  GenerateAudioOptions,
  IAudioProvider,
} from '../../domain/interfaces/IAudioProvider';
import { PythonTtsBridge } from './PythonTtsBridge';

export interface FishSpeechProviderConfig {
  repoPath: string;
  checkpointDir: string;
  referenceAudioPath: string;
  referenceText: string;
  temperature: number;
  topP: number;
}

export class FishSpeechAudioProvider implements IAudioProvider {
  private readonly bridge: PythonTtsBridge;

  constructor(
    private readonly providerConfig: FishSpeechProviderConfig,
    audioConfig: AudioConfig,
    workspaceRoot: string,
  ) {
    this.bridge = new PythonTtsBridge({
      engine: 'fish-speech',
      workspaceRoot,
      audioConfig,
      pythonTimeoutMs: 15 * 60 * 1000,
    });
  }

  async generate(text: string, options: GenerateAudioOptions = {}): Promise<AudioGenerateResult> {
    const sceneLabel = options.scene_id ?? 'unknown';
    console.log(`[Fish Speech] Scene ${sceneLabel} 음성 생성 (checkpoint=${this.providerConfig.checkpointDir})...`);
    const result = await this.bridge.synthesize({
      text,
      voice: this.providerConfig.referenceAudioPath || 'default',
      engineParams: {
        repoPath: this.providerConfig.repoPath,
        checkpointDir: this.providerConfig.checkpointDir,
        referenceAudioPath: this.providerConfig.referenceAudioPath,
        referenceText: this.providerConfig.referenceText,
        temperature: this.providerConfig.temperature,
        topP: this.providerConfig.topP,
      },
    });
    console.log(`  ✅ Fish Speech 합성 완료 (${result.durationSec.toFixed(2)}초)`);
    return result;
  }
}
