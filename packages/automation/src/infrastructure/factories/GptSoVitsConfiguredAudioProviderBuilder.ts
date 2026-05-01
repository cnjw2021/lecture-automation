import { AudioConfig } from '../../domain/interfaces/IAudioProvider';
import { AudioProviderFactoryResult } from '../../domain/interfaces/IAudioProviderFactory';
import { config } from '../config';
import { GptSoVitsAudioProvider } from '../providers/GptSoVitsAudioProvider';
import { ConfiguredAudioProviderBuilder } from './ConfiguredAudioProviderBuilder';

export class GptSoVitsConfiguredAudioProviderBuilder implements ConfiguredAudioProviderBuilder {
  readonly providerName = 'gpt_sovits';

  create(audioConfig: AudioConfig): AudioProviderFactoryResult {
    const c = config.providers.gpt_sovits;
    const required: Array<[string, string]> = [
      ['gptModelPath', c.gptModelPath],
      ['sovitsModelPath', c.sovitsModelPath],
      ['refWavPath', c.refWavPath],
      ['refText', c.refText],
    ];
    for (const [name, value] of required) {
      if (!value) {
        throw new Error(`config/tts.json 의 providers.gpt_sovits.${name} 가 설정되어 있지 않습니다.`);
      }
    }

    return {
      providerName: this.providerName,
      provider: new GptSoVitsAudioProvider(
        {
          repoPath: c.repoPath,
          gptModelPath: c.gptModelPath,
          sovitsModelPath: c.sovitsModelPath,
          refWavPath: c.refWavPath,
          refText: c.refText,
          refLanguage: c.refLanguage,
          targetLanguage: c.targetLanguage,
          topK: c.topK,
          topP: c.topP,
          temperature: c.temperature,
          speed: c.speed,
        },
        audioConfig,
        config.paths.root,
      ),
    };
  }
}
