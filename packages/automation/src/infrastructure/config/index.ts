import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs-extra';

dotenv.config();

const ROOT_DIR = path.join(__dirname, '../../../../../');

export const config = {
  active_audio_provider: process.env.AUDIO_PROVIDER || 'gemini',

  providers: {
    gemini: {
      apiKey: process.env.GEMINI_API_KEY || '',
      modelName: "gemini-2.5-flash-preview-tts",
      voice: process.env.TTS_VOICE || "Kore",
      language: process.env.TTS_LANGUAGE || "Japanese",
    },
    google_cloud_tts: {
      keyFilePath: process.env.GOOGLE_CLOUD_TTS_KEY_FILE || '',
      voiceName: process.env.GOOGLE_CLOUD_TTS_VOICE || 'ja-JP-Chirp3-HD-Kore',
      languageCode: process.env.GOOGLE_CLOUD_TTS_LANGUAGE_CODE || 'ja-JP',
    },
    gemini_cloud_tts: {
      keyFilePath: process.env.GOOGLE_CLOUD_TTS_KEY_FILE || '',
      // modelName: process.env.GEMINI_CLOUD_TTS_MODEL || 'gemini-2.5-flash-tts',
      modelName: process.env.GEMINI_CLOUD_TTS_MODEL || 'gemini-2.5-pro-tts',
      voiceName: process.env.GEMINI_CLOUD_TTS_VOICE || 'Orus',
      languageCode: process.env.GEMINI_CLOUD_TTS_LANGUAGE_CODE || 'ja-JP',
    },
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
    return videoConfig.tts || { speechRate: 0.85, pauseBetweenSentences: 'short' };
  }
};
