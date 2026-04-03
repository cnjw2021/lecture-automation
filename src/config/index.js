require('dotenv').config();
const path = require('path');

const ROOT_DIR = path.join(__dirname, '../../');

module.exports = {
  // 어떤 프로바이더를 사용할지에 대한 '식별자'만 가짐
  active_audio_provider: 'gemini', 
  
  providers: {
    gemini: {
      apiKey: process.env.GEMINI_API_KEY,
      modelName: "gemini-1.5-flash",
    },
    openai: {
      apiKey: process.env.OPENAI_API_KEY,
      modelName: "tts-1",
    }
  },

  paths: {
    root: ROOT_DIR,
    data: path.join(ROOT_DIR, 'data'),
    audio: path.join(ROOT_DIR, 'remotion-project/public/audio'),
    captures: path.join(ROOT_DIR, 'remotion-project/public/captures'),
  }
};
