import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs-extra';

dotenv.config();

const ROOT_DIR = path.join(__dirname, '../../../../../');

const getTtsJson = () => {
  const ttsConfigPath = path.join(ROOT_DIR, 'config/tts.json');
  if (!fs.existsSync(ttsConfigPath)) {
    throw new Error(`config/tts.json 파일이 없습니다: ${ttsConfigPath}`);
  }
  return fs.readJsonSync(ttsConfigPath);
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
    screenshots: path.join(ROOT_DIR, 'packages/remotion/public/screenshots'),
    output: path.join(ROOT_DIR, 'output'),
    clips: path.join(ROOT_DIR, 'output', 'clips'),
  },

  getVideoConfig: () => {
    const videoConfigPath = path.join(ROOT_DIR, 'config/video.json');
    if (!fs.existsSync(videoConfigPath)) {
      throw new Error(`config/video.json 파일이 없습니다: ${videoConfigPath}`);
    }
    return fs.readJsonSync(videoConfigPath);
  },

  getTtsConfig: () => {
    const tts = getTtsJson();
    const activeProvider = tts.activeProvider;
    const providerConfig = tts.providers[activeProvider];
    return {
      speechRate: providerConfig.speechRate,
      pauseBetweenSentences: tts.pauseBetweenSentences,
    };
  },
};
