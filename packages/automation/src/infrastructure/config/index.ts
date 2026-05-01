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
      kokoro: {
        voice: tts.providers?.kokoro?.voice ?? 'jf_alpha',
        modelPath: tts.providers?.kokoro?.modelPath ?? 'tools/tts/python/kokoro/models/kokoro-v1.0.onnx',
        voicesPath: tts.providers?.kokoro?.voicesPath ?? 'tools/tts/python/kokoro/models/voices-v1.0.bin',
        speed: typeof tts.providers?.kokoro?.speed === 'number' ? tts.providers.kokoro.speed : 1.0,
        g2pMode: (tts.providers?.kokoro?.g2pMode ?? 'auto') as 'auto' | 'direct' | 'phoneme',
      },
      xtts: {
        modelName: tts.providers?.xtts?.modelName ?? 'tts_models/multilingual/multi-dataset/xtts_v2',
        speakerWavPath: tts.providers?.xtts?.speakerWavPath ?? '',
        language: tts.providers?.xtts?.language ?? 'ja',
        temperature: typeof tts.providers?.xtts?.temperature === 'number' ? tts.providers.xtts.temperature : 0.7,
        lengthPenalty: typeof tts.providers?.xtts?.length_penalty === 'number' ? tts.providers.xtts.length_penalty : 1.0,
      },
      gpt_sovits: {
        repoPath: tts.providers?.gpt_sovits?.repoPath ?? 'tools/tts/python/gpt-sovits/models/GPT-SoVITS',
        gptModelPath: tts.providers?.gpt_sovits?.gptModelPath ?? '',
        sovitsModelPath: tts.providers?.gpt_sovits?.sovitsModelPath ?? '',
        refWavPath: tts.providers?.gpt_sovits?.refWavPath ?? '',
        refText: tts.providers?.gpt_sovits?.refText ?? '',
        refLanguage: tts.providers?.gpt_sovits?.refLanguage ?? 'ja',
        targetLanguage: tts.providers?.gpt_sovits?.targetLanguage ?? 'ja',
        topK: typeof tts.providers?.gpt_sovits?.topK === 'number' ? tts.providers.gpt_sovits.topK : 5,
        topP: typeof tts.providers?.gpt_sovits?.topP === 'number' ? tts.providers.gpt_sovits.topP : 1.0,
        temperature: typeof tts.providers?.gpt_sovits?.temperature === 'number' ? tts.providers.gpt_sovits.temperature : 1.0,
        speed: typeof tts.providers?.gpt_sovits?.speed === 'number' ? tts.providers.gpt_sovits.speed : 1.0,
      },
      fish_speech: {
        repoPath: tts.providers?.fish_speech?.repoPath ?? 'tools/tts/python/fish-speech/models/fish-speech',
        checkpointDir: tts.providers?.fish_speech?.checkpointDir ?? '',
        referenceAudioPath: tts.providers?.fish_speech?.referenceAudioPath ?? '',
        referenceText: tts.providers?.fish_speech?.referenceText ?? '',
        temperature: typeof tts.providers?.fish_speech?.temperature === 'number' ? tts.providers.fish_speech.temperature : 0.7,
        topP: typeof tts.providers?.fish_speech?.topP === 'number' ? tts.providers.fish_speech.topP : 0.7,
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

  getWarmupPaddingConfig: () => {
    const tts = getTtsJson();
    const activeProvider = tts.activeProvider;
    const providerConfig = tts.providers?.[activeProvider];
    const wp = providerConfig?.warmupPadding;
    return {
      enabled: wp?.enabled ?? false,
      text: typeof wp?.text === 'string' ? wp.text : 'これからお話しします。',
      trimGuardMs: typeof wp?.trimGuardMs === 'number' ? wp.trimGuardMs : 0,
    };
  },

  getTailPaddingConfig: () => {
    const tts = getTtsJson();
    const activeProvider = tts.activeProvider;
    const providerConfig = tts.providers?.[activeProvider];
    const tp = providerConfig?.tailPadding;
    return {
      enabled: tp?.enabled ?? true,
      paddingMs: typeof tp?.paddingMs === 'number' ? tp.paddingMs : 150,
    };
  },

  getHeadPaddingConfig: () => {
    const tts = getTtsJson();
    const activeProvider = tts.activeProvider;
    const providerConfig = tts.providers?.[activeProvider];
    const hp = providerConfig?.headPadding;
    return {
      enabled: hp?.enabled ?? false,
      paddingMs: typeof hp?.paddingMs === 'number' ? hp.paddingMs : 0,
    };
  },

  getAuditConfig: () => {
    const auditConfigPath = path.join(ROOT_DIR, 'config/audit.json');
    if (!fs.existsSync(auditConfigPath)) {
      throw new Error(`config/audit.json 파일이 없습니다: ${auditConfigPath}`);
    }
    const audit = fs.readJsonSync(auditConfigPath);
    const providerName: string = process.env.AUDIT_PROVIDER ?? audit.provider ?? 'gemini';
    const providerConfig = audit.providers?.[providerName] ?? {};
    return {
      providerName,
      modelName: providerConfig.modelName ?? 'gemini-2.5-flash',
      temperature: typeof providerConfig.temperature === 'number' ? providerConfig.temperature : 0,
      excludeScenes: Array.isArray(audit.excludeScenes) ? (audit.excludeScenes as number[]) : [],
      runs: typeof audit.runs === 'number' ? audit.runs : 1,
    };
  },
};
