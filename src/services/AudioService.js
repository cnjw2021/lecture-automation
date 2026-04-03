const fs = require('fs-extra');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const config = require('../config');

class AudioService {
  constructor() {
    this.genAI = new GoogleGenerativeAI(config.GEMINI_API_KEY);
    this.model = this.genAI.getGenerativeModel({ model: config.model.name });
  }

  async generateFromLecture(lectureData) {
    const audioOutputDir = path.join(config.paths.audio, lectureData.lecture_id);
    await fs.ensureDir(audioOutputDir);

    console.log(`[${lectureData.lecture_id}] 오디오 생성 시작...`);

    for (const scene of lectureData.sequence) {
      const outputPath = path.join(audioOutputDir, `scene-${scene.scene_id}.wav`);
      
      if (await fs.pathExists(outputPath)) continue;

      try {
        const result = await this.model.generateContent([
          { text: `다음 텍스트를 나레이션으로 읽어줘: "${scene.narration}"` }
        ]);
        // TODO: 실제 오디오 데이터 저장 로직은 SDK 사양에 맞춰 구현
        console.log(`- Scene ${scene.scene_id} 생성 성공`);
      } catch (error) {
        console.error(`- Scene ${scene.scene_id} 에러:`, error.message);
      }
    }
  }
}

module.exports = new AudioService();
