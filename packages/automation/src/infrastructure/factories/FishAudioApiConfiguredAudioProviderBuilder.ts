import { AudioConfig } from '../../domain/interfaces/IAudioProvider';
import { AudioProviderFactoryResult } from '../../domain/interfaces/IAudioProviderFactory';
import { config } from '../config';
import { FishAudioApiProvider } from '../providers/FishAudioApiProvider';
import { ConfiguredAudioProviderBuilder } from './ConfiguredAudioProviderBuilder';

export class FishAudioApiConfiguredAudioProviderBuilder implements ConfiguredAudioProviderBuilder {
  readonly providerName = 'fish_audio_api';

  create(audioConfig: AudioConfig): AudioProviderFactoryResult {
    const c = config.providers.fish_audio_api;
    if (!c.apiKey) {
      throw new Error(
        'FISH_AUDIO_API_KEY 환경변수가 설정되어 있지 않습니다. ' +
        'fish.audio 의 API key 를 .env 에 설정하세요.',
      );
    }
    if (!c.voiceId) {
      throw new Error(
        'config/tts.json 의 providers.fish_audio_api.voiceId 가 비어있습니다. ' +
        'fish.audio 에서 voice 등록 후 ID 를 입력하세요.',
      );
    }

    return {
      providerName: this.providerName,
      provider: new FishAudioApiProvider(
        {
          apiKey: c.apiKey,
          voiceId: c.voiceId,
          modelName: c.modelName,
          temperature: c.temperature,
          topP: c.topP,
          speed: c.speed,
          normalize: c.normalize,
        },
        audioConfig,
      ),
    };
  }
}
