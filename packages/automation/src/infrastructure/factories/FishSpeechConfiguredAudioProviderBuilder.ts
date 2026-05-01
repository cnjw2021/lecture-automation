import { AudioConfig } from '../../domain/interfaces/IAudioProvider';
import { AudioProviderFactoryResult } from '../../domain/interfaces/IAudioProviderFactory';
import { config } from '../config';
import { FishSpeechAudioProvider } from '../providers/FishSpeechAudioProvider';
import { ConfiguredAudioProviderBuilder } from './ConfiguredAudioProviderBuilder';

export class FishSpeechConfiguredAudioProviderBuilder implements ConfiguredAudioProviderBuilder {
  readonly providerName = 'fish_speech';

  create(audioConfig: AudioConfig): AudioProviderFactoryResult {
    const c = config.providers.fish_speech;
    if (!c.checkpointDir) {
      throw new Error('config/tts.json 의 providers.fish_speech.checkpointDir 가 설정되어 있지 않습니다.');
    }
    return {
      providerName: this.providerName,
      provider: new FishSpeechAudioProvider(
        {
          repoPath: c.repoPath,
          checkpointDir: c.checkpointDir,
          referenceAudioPath: c.referenceAudioPath,
          referenceText: c.referenceText,
          temperature: c.temperature,
          topP: c.topP,
        },
        audioConfig,
        config.paths.root,
      ),
    };
  }
}
