require('dotenv').config();
const path = require('path');

const ROOT_DIR = path.join(__dirname, '../../');

/**
 * Single Source of Truth (SSoT)
 * 모든 모델과 프로젝트 전역 설정을 이곳에서 관리함
 */
module.exports = {
  // 사용 중인 모델 설정
  active_audio_model: 'gemini', // 'openai', 'gemini' 등 변경 가능 (OCP)
  
  models: {
    gemini: {
      provider: require('../providers/GeminiAudioProvider'),
      apiKey: process.env.GEMINI_API_KEY,
      name: "gemini-1.5-flash",
    },
    // 향후 OpenAI 등 추가 시 여기서만 설정하면 됨
    // openai: { ... }
  },

  paths: {
    root: ROOT_DIR,
    data: path.join(ROOT_DIR, 'data'),
    audio: path.join(ROOT_DIR, 'remotion-project/public/audio'),
    captures: path.join(ROOT_DIR, 'remotion-project/public/captures'),
  }
};
