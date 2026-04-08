import { AudioConfig } from '../../domain/interfaces/IAudioProvider';
import { AudioProviderFactoryResult } from '../../domain/interfaces/IAudioProviderFactory';

export interface ConfiguredAudioProviderBuilder {
  readonly providerName: string;
  create(audioConfig: AudioConfig): AudioProviderFactoryResult;
}
