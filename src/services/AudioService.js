const fs = require('fs-extra');
const path = require('path');
const config = require('../config');

class AudioService {
  /**
   * DIP (의존성 역전 원칙) 준수
   * AudioService는 추상화된 AudioProvider(인터페이스)에만 의존하며,
   * 구체적인 GeminiAudioProvider 등에 대해서는 전혀 알지 못합니다.
   */
  constructor(audioProvider) {
    this.audioProvider = audioProvider;
  }

  async generateFromLecture(lectureData) {
    const audioOutputDir = path.join(config.paths.audio, lectureData.lecture_id);
    await fs.ensureDir(audioOutputDir);

    console.log(`[${lectureData.lecture_id}] 오디오 생성 시작... (Provider: ${this.audioProvider.constructor.name})`);

    for (const scene of lectureData.sequence) {
      const outputPath = path.join(audioOutputDir, `scene-${scene.scene_id}.wav`);
      
      if (await fs.pathExists(outputPath)) continue;

      try {
        // 추상 메서드 호출
        await this.audioProvider.generate(scene.narration, { scene_id: scene.scene_id });
      } catch (error) {
        console.error(`- Scene ${scene.scene_id} 에러:`, error.message);
      }
    }
  }
}

module.exports = AudioService;
