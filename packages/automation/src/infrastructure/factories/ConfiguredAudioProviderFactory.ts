import { AudioProviderFactoryResult, IAudioProviderFactory } from '../../domain/interfaces/IAudioProviderFactory';
import { config } from '../config';
import { GeminiAudioProvider } from '../providers/GeminiAudioProvider';
import { GeminiCloudTtsProvider } from '../providers/GeminiCloudTtsProvider';
import { GoogleCloudTtsProvider } from '../providers/GoogleCloudTtsProvider';

export class ConfiguredAudioProviderFactory implements IAudioProviderFactory {
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

    if (providerName === 'gemini_cloud_tts') {
      const gcConfig = config.providers.gemini_cloud_tts;
      if (!gcConfig.keyFilePath) {
        throw new Error('GOOGLE_CLOUD_TTS_KEY_FILE이 설정되어 있지 않습니다.');
      }
      return {
        providerName,
        provider: new GeminiCloudTtsProvider(gcConfig.keyFilePath, gcConfig.modelName, gcConfig.voiceName, gcConfig.languageCode, audioConfig),
      };
    }

    if (providerName === 'google_cloud_tts') {
      const gcConfig = config.providers.google_cloud_tts;
      if (!gcConfig.keyFilePath) {
        throw new Error('GOOGLE_CLOUD_TTS_KEY_FILE이 설정되어 있지 않습니다.');
      }
      return {
        providerName,
        provider: new GoogleCloudTtsProvider(gcConfig.keyFilePath, gcConfig.voiceName, gcConfig.languageCode, audioConfig),
      };
    }

    const geminiConfig = config.providers.gemini;
    if (!geminiConfig.apiKey || geminiConfig.apiKey === 'YOUR_GEMINI_API_KEY_HERE') {
      throw new Error('GEMINI_API_KEY가 설정되어 있지 않습니다.');
    }
    return {
      providerName,
      provider: new GeminiAudioProvider(geminiConfig.apiKey, geminiConfig.modelName, geminiConfig.voice, geminiConfig.language, audioConfig),
    };
  }
}
