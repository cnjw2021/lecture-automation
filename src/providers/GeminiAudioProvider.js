const { GoogleGenerativeAI } = require('@google/generative-ai');
const AudioProvider = require('./AudioProvider');

class GeminiAudioProvider extends AudioProvider {
  constructor(apiKey, modelName) {
    super();
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({ model: modelName });
  }

  async generate(text, { scene_id }) {
    console.log(`[Gemini] Scene ${scene_id} 생성 중...`);
    // Gemini Audio Output Logic (Multimodal)
    const result = await this.model.generateContent([{ text }]);
    // 실제 오디오 데이터 반환 처리
    return result; 
  }
}

module.exports = GeminiAudioProvider;
