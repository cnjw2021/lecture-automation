import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs-extra';

dotenv.config();

const ROOT_DIR = path.join(__dirname, '../../../../../');

const getTtsJson = () => {
  const ttsConfigPath = path.join(ROOT_DIR, 'config/tts.json');
  if (fs.existsSync(ttsConfigPath)) {
    return fs.readJsonSync(ttsConfigPath);
  }
  return {
    activeProvider: 'gemini',
    providers: {
      gemini: { modelName: 'gemini-2.5-flash-preview-tts', voice: 'Kore', language: 'Japanese' },
      google_cloud_tts: { voiceName: 'ja-JP-Chirp3-HD-Kore', languageCode: 'ja-JP' },
      gemini_cloud_tts: { modelName: 'gemini-2.5-pro-tts', voiceName: 'Orus', languageCode: 'ja-JP' },
    },
  };
};

export const config = {
  get active_audio_provider() {
    return getTtsJson().activeProvider;
  },

  get providers() {
    const tts = getTtsJson();
    return {
      gemini: {
        apiKey: process.env.GEMINI_API_KEY || '',
        modelName: tts.providers.gemini.modelName,
        voice: tts.providers.gemini.voice,
        language: tts.providers.gemini.language,
      },
      google_cloud_tts: {
        keyFilePath: process.env.GOOGLE_CLOUD_TTS_KEY_FILE || '',
        voiceName: tts.providers.google_cloud_tts.voiceName,
        languageCode: tts.providers.google_cloud_tts.languageCode,
      },
      gemini_cloud_tts: {
        keyFilePath: process.env.GOOGLE_CLOUD_TTS_KEY_FILE || '',
        modelName: tts.providers.gemini_cloud_tts.modelName,
        voiceName: tts.providers.gemini_cloud_tts.voiceName,
        languageCode: tts.providers.gemini_cloud_tts.languageCode,
      },
    };
  },

  paths: {
    root: ROOT_DIR,
    data: path.join(ROOT_DIR, 'data'),
    audio: path.join(ROOT_DIR, 'packages/remotion/public/audio'),
    captures: path.join(ROOT_DIR, 'packages/remotion/public/captures'),
    output: path.join(ROOT_DIR, 'output'),
  },

  getVideoConfig: () => {
    const videoConfigPath = path.join(ROOT_DIR, 'config/video.json');
    if (fs.existsSync(videoConfigPath)) {
      return fs.readJsonSync(videoConfigPath);
    }
    return { audio: { sampleRate: 24000, channels: 1, bitDepth: 16 }, resolution: { width: 1920, height: 1080 }, tts: { speechRate: 0.85 } };
  },

  getTtsConfig: () => {
    const videoConfig = config.getVideoConfig();
    return videoConfig.tts || { speechRate: 0.85 };
  },
};
