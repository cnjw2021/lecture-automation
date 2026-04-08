import { AudioConfig } from '../../domain/interfaces/IAudioProvider';
import { AudioProviderFactoryResult } from '../../domain/interfaces/IAudioProviderFactory';
import { config } from '../config';
import { GeminiCloudTtsProvider } from '../providers/GeminiCloudTtsProvider';
import { ConfiguredAudioProviderBuilder } from './ConfiguredAudioProviderBuilder';

export class GeminiCloudTtsConfiguredAudioProviderBuilder implements ConfiguredAudioProviderBuilder {
  readonly providerName = 'gemini_cloud_tts';

  create(audioConfig: AudioConfig): AudioProviderFactoryResult {
    const gcConfig = config.providers.gemini_cloud_tts;
    if (!gcConfig.keyFilePath) {
      throw new Error('GOOGLE_CLOUD_TTS_KEY_FILE이 설정되어 있지 않습니다.');
    }

    return {
      providerName: this.providerName,
      provider: new GeminiCloudTtsProvider(
        gcConfig.keyFilePath,
        gcConfig.modelName,
        gcConfig.voiceName,
        gcConfig.languageCode,
        gcConfig.prompt,
        audioConfig,
      ),
    };
  }
}
