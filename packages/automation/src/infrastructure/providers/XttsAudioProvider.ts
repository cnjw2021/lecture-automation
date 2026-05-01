import {
  AudioConfig,
  AudioGenerateResult,
  GenerateAudioOptions,
  IAudioProvider,
} from '../../domain/interfaces/IAudioProvider';
import { PythonTtsBridge } from './PythonTtsBridge';

export interface XttsProviderConfig {
  modelName: string;
  speakerWavPath: string;
  language: string;
  temperature: number;
  lengthPenalty: number;
}

export class XttsAudioProvider implements IAudioProvider {
  private readonly bridge: PythonTtsBridge;

  constructor(
    private readonly providerConfig: XttsProviderConfig,
    audioConfig: AudioConfig,
    workspaceRoot: string,
  ) {
    this.bridge = new PythonTtsBridge({
      engine: 'xtts',
      workspaceRoot,
      audioConfig,
      // XTTS-v2 는 CPU 에서 모델 로드만 30~60초, 합성도 느림
      pythonTimeoutMs: 15 * 60 * 1000,
    });
  }

  async generate(text: string, options: GenerateAudioOptions = {}): Promise<AudioGenerateResult> {
    const sceneLabel = options.scene_id ?? 'unknown';
    console.log(`[XTTS-v2] Scene ${sceneLabel} 음성 생성 (lang=${this.providerConfig.language})...`);
    const result = await this.bridge.synthesize({
      text,
      voice: this.providerConfig.speakerWavPath,
      engineParams: {
        modelName: this.providerConfig.modelName,
        speakerWavPath: this.providerConfig.speakerWavPath,
        language: this.providerConfig.language,
        temperature: this.providerConfig.temperature,
        length_penalty: this.providerConfig.lengthPenalty,
      },
    });
    console.log(`  ✅ XTTS-v2 합성 완료 (${result.durationSec.toFixed(2)}초)`);
    return result;
  }
}
