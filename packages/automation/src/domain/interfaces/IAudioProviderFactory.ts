import { IAudioProvider } from './IAudioProvider';

export interface AudioProviderFactoryResult {
  provider: IAudioProvider;
  providerName: string;
}

export interface IAudioProviderFactory {
  create(): AudioProviderFactoryResult;
}
