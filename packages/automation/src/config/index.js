require('dotenv').config();
const path = require('path');

// Monorepo 루트 경로 계산: /packages/automation/src/config/index.js -> /
const ROOT_DIR = path.join(__dirname, '../../../../');

module.exports = {
  active_audio_provider: 'gemini', 
  
  providers: {
    gemini: {
      apiKey: process.env.GEMINI_API_KEY,
      modelName: "gemini-1.5-flash",
    }
  },

  paths: {
    root: ROOT_DIR,
    data: path.join(ROOT_DIR, 'data'),
    // Monorepo 구조에서는 각 패키지의 public 폴더를 정확히 가리킴
    audio: path.join(ROOT_DIR, 'packages/remotion/public/audio'),
    captures: path.join(ROOT_DIR, 'packages/remotion/public/captures'),
  }
};
