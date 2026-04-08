import { IMasterAudioGenerator } from '../../domain/interfaces/IMasterAudioGenerator';
import { config } from '../config';
import { GeminiMasterAudioProvider } from '../providers/GeminiMasterAudioProvider';

export class ConfiguredMasterAudioGeneratorFactory {
  create(): IMasterAudioGenerator | null {
    const masterAudioConfig = config.getMasterAudioConfig();
    if (!masterAudioConfig.enabled) {
      return null;
    }

    if (masterAudioConfig.provider !== 'gemini') {
      throw new Error(`지원하지 않는 master audio provider입니다: ${masterAudioConfig.provider}`);
    }
    if (!masterAudioConfig.apiKey || masterAudioConfig.apiKey === 'YOUR_GEMINI_API_KEY_HERE') {
      throw new Error('master audio 생성용 GEMINI_API_KEY가 설정되어 있지 않습니다.');
    }

    const videoConfig = config.getVideoConfig();
    const audioConfig = {
      sampleRate: videoConfig.audio.sampleRate,
      channels: videoConfig.audio.channels,
      bitDepth: videoConfig.audio.bitDepth,
      speechRate: masterAudioConfig.speechRate,
    };

    return new GeminiMasterAudioProvider(
      masterAudioConfig.apiKey,
      masterAudioConfig.modelName,
      masterAudioConfig.voiceName,
      masterAudioConfig.styleVersion,
      masterAudioConfig.prompt,
      audioConfig,
      masterAudioConfig.temperature,
      masterAudioConfig.seed,
    );
  }
}
