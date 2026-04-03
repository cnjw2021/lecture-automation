const fs = require('fs-extra');
const path = require('path');
const config = require('../config');

class AudioService {
  /**
   * Dependency Injection (DI)
   * 생성자에서 provider를 주입받아 OCP 원칙을 준수함
   */
  constructor(provider) {
    this.provider = provider;
  }

  async generateFromLecture(lectureData) {
    const audioOutputDir = path.join(config.paths.audio, lectureData.lecture_id);
    await fs.ensureDir(audioOutputDir);

    console.log(`[${lectureData.lecture_id}] 오디오 생성 시작...`);

    for (const scene of lectureData.sequence) {
      const outputPath = path.join(audioOutputDir, `scene-${scene.scene_id}.wav`);
      
      if (await fs.pathExists(outputPath)) continue;

      try {
        // 주입받은 provider를 통해 비즈니스 로직 수행
        await this.provider.generate(scene.narration, { scene_id: scene.scene_id });
      } catch (error) {
        console.error(`- Scene ${scene.scene_id} 에러:`, error.message);
      }
    }
  }
}

// SSoT 설정을 기반으로 서비스 인스턴스화
const activeModelConfig = config.models[config.active_audio_model];
const ProviderClass = activeModelConfig.provider;
const provider = new ProviderClass(activeModelConfig.apiKey, activeModelConfig.name);

module.exports = new AudioService(provider);
