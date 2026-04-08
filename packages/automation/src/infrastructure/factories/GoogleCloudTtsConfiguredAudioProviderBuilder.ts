import { AudioConfig } from '../../domain/interfaces/IAudioProvider';
import { AudioProviderFactoryResult } from '../../domain/interfaces/IAudioProviderFactory';
import { config } from '../config';
import { GoogleCloudTtsProvider } from '../providers/GoogleCloudTtsProvider';
import { ConfiguredAudioProviderBuilder } from './ConfiguredAudioProviderBuilder';

export class GoogleCloudTtsConfiguredAudioProviderBuilder implements ConfiguredAudioProviderBuilder {
  readonly providerName = 'google_cloud_tts';

  create(audioConfig: AudioConfig): AudioProviderFactoryResult {
    const gcConfig = config.providers.google_cloud_tts;
    if (!gcConfig.keyFilePath) {
      throw new Error('GOOGLE_CLOUD_TTS_KEY_FILE이 설정되어 있지 않습니다.');
    }

    return {
      providerName: this.providerName,
      provider: new GoogleCloudTtsProvider(gcConfig.keyFilePath, gcConfig.voiceName, gcConfig.languageCode, audioConfig),
    };
  }
}
