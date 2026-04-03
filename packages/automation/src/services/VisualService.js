const path = require('path');
const config = require('../config');

class VisualService {
  constructor(visualProvider, lectureRepository) {
    this.provider = visualProvider;
    this.repository = lectureRepository;
  }

  async processLecture(lecture) {
    console.log(`[${lecture.lecture_id}] 시각 자료 녹화 공정 시작 (Provider: ${this.provider.constructor.name})`);

    for (const scene of lecture.sequence) {
      // 1. Playwright 타입이 아닌 경우 건너뜀
      if (scene.visual.type !== 'playwright') continue;

      // 2. 이미 존재하는지 확인
      const outputPath = path.join(config.paths.captures, lecture.lecture_id, `scene-${scene.scene_id}.webm`);
      if (await this.repository.existsCapture(lecture.lecture_id, scene.scene_id)) {
        console.log(`- Scene ${scene.scene_id} 영상 이미 존재함`);
        continue;
      }

      // 3. 녹화 실행
      try {
        await this.provider.record(scene, outputPath);
      } catch (error) {
        console.error(`- Scene ${scene.scene_id} 녹화 실패:`, error.message);
      }
    }
  }
}

module.exports = VisualService;
