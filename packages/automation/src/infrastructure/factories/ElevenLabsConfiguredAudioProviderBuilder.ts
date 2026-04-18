import { AudioConfig } from '../../domain/interfaces/IAudioProvider';
import { AudioProviderFactoryResult } from '../../domain/interfaces/IAudioProviderFactory';
import { config } from '../config';
import { ElevenLabsAudioProvider } from '../providers/ElevenLabsAudioProvider';
import { ConfiguredAudioProviderBuilder } from './ConfiguredAudioProviderBuilder';

export class ElevenLabsConfiguredAudioProviderBuilder implements ConfiguredAudioProviderBuilder {
  readonly providerName = 'elevenlabs';

  create(audioConfig: AudioConfig): AudioProviderFactoryResult {
    const elConfig = config.providers.elevenlabs;
    if (!elConfig.apiKey) {
      throw new Error('ELEVENLABS_API_KEY가 설정되어 있지 않습니다.');
    }
    if (!elConfig.voiceId || elConfig.voiceId === 'YOUR_ELEVENLABS_VOICE_ID') {
      throw new Error('config/tts.json의 providers.elevenlabs.voiceId를 설정해 주세요.');
    }

    const warmupPadding = config.getWarmupPaddingConfig();

    return {
      providerName: this.providerName,
      provider: new ElevenLabsAudioProvider(
        elConfig.apiKey,
        elConfig.voiceId,
        elConfig.modelId,
        elConfig.languageCode,
        elConfig.seed,
        elConfig.voiceSettings,
        audioConfig,
        warmupPadding,
      ),
    };
  }
}
