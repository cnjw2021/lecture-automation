import { AudioConfig } from '../../domain/interfaces/IAudioProvider';
import { AudioProviderFactoryResult } from '../../domain/interfaces/IAudioProviderFactory';
import { config } from '../config';
import { GeminiAudioProvider } from '../providers/GeminiAudioProvider';
import { ConfiguredAudioProviderBuilder } from './ConfiguredAudioProviderBuilder';

export class GeminiConfiguredAudioProviderBuilder implements ConfiguredAudioProviderBuilder {
  readonly providerName = 'gemini';

  create(audioConfig: AudioConfig): AudioProviderFactoryResult {
    const geminiConfig = config.providers.gemini;
    if (!geminiConfig.apiKey || geminiConfig.apiKey === 'YOUR_GEMINI_API_KEY_HERE') {
      throw new Error('GEMINI_API_KEY가 설정되어 있지 않습니다.');
    }

    return {
      providerName: this.providerName,
      provider: new GeminiAudioProvider(
        geminiConfig.apiKey,
        geminiConfig.modelName,
        geminiConfig.voice,
        geminiConfig.language,
        geminiConfig.prompt,
        audioConfig,
        geminiConfig.temperature,
        geminiConfig.seed,
      ),
    };
  }
}
