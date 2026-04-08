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

const DEFAULT_MASTER_AUDIO_PROMPT = '次の日本語原稿を、実在の人物を模倣しない範囲で、日本のIT入門講座を担当するプロ講師のような雰囲気で読んでください。落ち着きがあり、信頼感のある標準的な日本語で、初学者にもわかりやすいように、はっきり丁寧に読んでください。実際のオンライン講義のように自然で親しみやすい話し方にし、大げさな演技、広告っぽい語り、アニメ声は避けてください。大事なポイントだけを軽く強調し、文と文の間、段落の切り替わりでは短く自然な間を入れてください。HTML、CSS、JavaScript、APIなどのIT用語は自然かつ正確に発音してください。';

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

  getMasterAudioConfig: () => {
    const tts = getTtsJson();
    const masterAudio = tts.masterAudio || {};
    return {
      enabled: masterAudio.enabled ?? false,
      provider: masterAudio.provider || 'gemini',
      apiKey: process.env.GEMINI_API_KEY || '',
      modelName: masterAudio.modelName || 'gemini-2.5-pro-preview-tts',
      voiceName: masterAudio.voiceName || tts.providers.gemini.voice || 'Kore',
      styleVersion: masterAudio.styleVersion || 'v1',
      speechRate: masterAudio.speechRate ?? 1,
      temperature: typeof masterAudio.temperature === 'number' ? masterAudio.temperature : 0,
      prompt: masterAudio.prompt || DEFAULT_MASTER_AUDIO_PROMPT,
      seed: typeof masterAudio.seed === 'number' ? masterAudio.seed : undefined,
    };
  },
};
