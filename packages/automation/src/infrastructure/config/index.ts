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

function getRequiredMasterAudioPrompt(tts: any): string {
  const prompt = tts.masterAudio?.prompt;
  if (typeof prompt !== 'string' || prompt.trim().length === 0) {
    throw new Error('config/tts.json의 masterAudio.prompt는 필수 문자열입니다.');
  }
  return prompt;
}

function getOptionalGeminiPrompt(tts: any): string {
  const prompt = tts.providers?.gemini?.prompt;
  return typeof prompt === 'string' ? prompt.trim() : '';
}

function getOptionalGeminiCloudTtsPrompt(tts: any): string {
  const prompt = tts.providers?.gemini_cloud_tts?.prompt;
  return typeof prompt === 'string' ? prompt.trim() : '';
}

function getOptionalElevenLabsVoiceSettings(provider: any) {
  return {
    stability: typeof provider?.stability === 'number' ? provider.stability : 0.85,
    similarity_boost: typeof provider?.similarity_boost === 'number' ? provider.similarity_boost : 0.9,
    style: typeof provider?.style === 'number' ? provider.style : 0,
    use_speaker_boost: typeof provider?.use_speaker_boost === 'boolean' ? provider.use_speaker_boost : true,
    speed: typeof provider?.speed === 'number' ? provider.speed : 1,
  };
}

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
        temperature: typeof tts.providers.gemini.temperature === 'number' ? tts.providers.gemini.temperature : 0,
        seed: typeof tts.providers.gemini.seed === 'number' ? tts.providers.gemini.seed : undefined,
        prompt: getOptionalGeminiPrompt(tts),
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
        prompt: getOptionalGeminiCloudTtsPrompt(tts),
      },
      elevenlabs: {
        apiKey: process.env.ELEVENLABS_API_KEY || '',
        voiceId: tts.providers.elevenlabs.voiceId,
        modelId: tts.providers.elevenlabs.modelId,
        languageCode: tts.providers.elevenlabs.languageCode,
        seed: typeof tts.providers.elevenlabs.seed === 'number' ? tts.providers.elevenlabs.seed : undefined,
        voiceSettings: getOptionalElevenLabsVoiceSettings(tts.providers.elevenlabs),
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
    const speechRate = typeof providerConfig.speechRate === 'number'
      ? providerConfig.speechRate
      : typeof providerConfig.speed === 'number'
        ? providerConfig.speed
        : undefined;
    return {
      speechRate,
      pauseBetweenSentences: tts.pauseBetweenSentences,
    };
  },

  getChunkedGenerationConfig: () => {
    const tts = getTtsJson();
    const activeProvider = tts.activeProvider;
    const providerConfig = tts.providers?.[activeProvider];
    const chunked = providerConfig?.chunkedGeneration;
    return {
      enabled: chunked?.enabled ?? false,
      maxCharsPerChunk: typeof chunked?.maxCharsPerChunk === 'number' ? chunked.maxCharsPerChunk : 2500,
    };
  },

  getMasterAudioConfig: () => {
    const tts = getTtsJson();
    const masterAudio = tts.masterAudio || {};
    const enabled = masterAudio.enabled ?? false;
    return {
      enabled,
      provider: masterAudio.provider || 'gemini',
      apiKey: process.env.GEMINI_API_KEY || '',
      modelName: masterAudio.modelName || 'gemini-2.5-pro-preview-tts',
      voiceName: masterAudio.voiceName || tts.providers.gemini.voice || 'Kore',
      styleVersion: masterAudio.styleVersion || 'v1',
      speechRate: masterAudio.speechRate ?? 1,
      temperature: typeof masterAudio.temperature === 'number' ? masterAudio.temperature : 0,
      prompt: enabled ? getRequiredMasterAudioPrompt(tts) : '',
      seed: typeof masterAudio.seed === 'number' ? masterAudio.seed : undefined,
    };
  },
};
