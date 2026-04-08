import { AudioProviderFactoryResult, IAudioProviderFactory } from '../../domain/interfaces/IAudioProviderFactory';
import { config } from '../config';
import { ConfiguredAudioProviderBuilder } from './ConfiguredAudioProviderBuilder';

export class ConfiguredAudioProviderFactory implements IAudioProviderFactory {
  constructor(private readonly builders: ConfiguredAudioProviderBuilder[]) {}

  create(): AudioProviderFactoryResult {
    const providerName = config.active_audio_provider;
    const videoConfig = config.getVideoConfig();
    const ttsConfig = config.getTtsConfig();
    const audioConfig = {
      sampleRate: videoConfig.audio.sampleRate,
      channels: videoConfig.audio.channels,
      bitDepth: videoConfig.audio.bitDepth,
      speechRate: ttsConfig.speechRate || 0.85,
    };

    const builder = this.builders.find(candidate => candidate.providerName === providerName);
    if (!builder) {
      const supportedProviders = this.builders.map(candidate => candidate.providerName).join(', ');
      throw new Error(`지원하지 않는 오디오 프로바이더입니다: ${providerName}. 지원 목록: ${supportedProviders}`);
    }

    return builder.create(audioConfig);
  }
}
