import * as path from 'path';
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
    private readonly workspaceRoot: string,
  ) {
    this.bridge = new PythonTtsBridge({
      engine: 'fish-speech',
      workspaceRoot,
      audioConfig,
      pythonTimeoutMs: 15 * 60 * 1000,
    });
  }

  private toAbsolute(p: string): string {
    return path.isAbsolute(p) ? p : path.resolve(this.workspaceRoot, p);
  }

  async generate(text: string, options: GenerateAudioOptions = {}): Promise<AudioGenerateResult> {
    const sceneLabel = options.scene_id ?? 'unknown';
    console.log(`[Fish Speech] Scene ${sceneLabel} 음성 생성 (checkpoint=${this.providerConfig.checkpointDir})...`);
    const referenceAudioAbs = this.providerConfig.referenceAudioPath
      ? this.toAbsolute(this.providerConfig.referenceAudioPath)
      : '';
    const result = await this.bridge.synthesize({
      text,
      voice: referenceAudioAbs || 'default',
      engineParams: {
        repoPath: this.toAbsolute(this.providerConfig.repoPath),
        checkpointDir: this.toAbsolute(this.providerConfig.checkpointDir),
        referenceAudioPath: referenceAudioAbs,
        referenceText: this.providerConfig.referenceText,
        temperature: this.providerConfig.temperature,
        topP: this.providerConfig.topP,
      },
    });
    console.log(`  ✅ Fish Speech 합성 완료 (${result.durationSec.toFixed(2)}초)`);
    return result;
  }
}
