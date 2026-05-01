import { AudioConfig } from '../../domain/interfaces/IAudioProvider';
import { AudioProviderFactoryResult } from '../../domain/interfaces/IAudioProviderFactory';
import { config } from '../config';
import { KokoroAudioProvider } from '../providers/KokoroAudioProvider';
import { ConfiguredAudioProviderBuilder } from './ConfiguredAudioProviderBuilder';

export class KokoroConfiguredAudioProviderBuilder implements ConfiguredAudioProviderBuilder {
  readonly providerName = 'kokoro';

  create(audioConfig: AudioConfig): AudioProviderFactoryResult {
    const kokoroConfig = config.providers.kokoro;
    if (!kokoroConfig.voice) {
      throw new Error('config/tts.json 의 providers.kokoro.voice 가 설정되어 있지 않습니다.');
    }
    return {
      providerName: this.providerName,
      provider: new KokoroAudioProvider(
        {
          voice: kokoroConfig.voice,
          modelPath: kokoroConfig.modelPath,
          voicesPath: kokoroConfig.voicesPath,
          speed: kokoroConfig.speed,
          g2pMode: kokoroConfig.g2pMode,
        },
        audioConfig,
        config.paths.root,
      ),
    };
  }
}
