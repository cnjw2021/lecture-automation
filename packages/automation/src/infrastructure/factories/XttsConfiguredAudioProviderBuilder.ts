import { AudioConfig } from '../../domain/interfaces/IAudioProvider';
import { AudioProviderFactoryResult } from '../../domain/interfaces/IAudioProviderFactory';
import { config } from '../config';
import { XttsAudioProvider } from '../providers/XttsAudioProvider';
import { ConfiguredAudioProviderBuilder } from './ConfiguredAudioProviderBuilder';

export class XttsConfiguredAudioProviderBuilder implements ConfiguredAudioProviderBuilder {
  readonly providerName = 'xtts';

  create(audioConfig: AudioConfig): AudioProviderFactoryResult {
    const xttsConfig = config.providers.xtts;
    if (!xttsConfig.speakerWavPath) {
      throw new Error(
        'config/tts.json 의 providers.xtts.speakerWavPath 가 설정되어 있지 않습니다. ' +
        'voice cloning 용 참조 WAV (6~30초, mono) 를 지정하세요.',
      );
    }
    return {
      providerName: this.providerName,
      provider: new XttsAudioProvider(
        {
          modelName: xttsConfig.modelName,
          speakerWavPath: xttsConfig.speakerWavPath,
          language: xttsConfig.language,
          temperature: xttsConfig.temperature,
          lengthPenalty: xttsConfig.lengthPenalty,
        },
        audioConfig,
        config.paths.root,
      ),
    };
  }
}
