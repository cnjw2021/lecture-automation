const fs = require('fs-extra');
const path = require('path');
const config = require('../config');

/**
 * SRP 준수: 파일 저장 및 경로 관리를 전담함
 */
class LectureRepository {
  constructor() {
    this.audioBaseDir = config.paths.audio;
    this.captureBaseDir = config.paths.captures;
  }

  async saveAudio(lectureId, sceneId, audioBuffer) {
    const dir = path.join(this.audioBaseDir, lectureId);
    await fs.ensureDir(dir);
    const filePath = path.join(dir, `scene-${sceneId}.wav`);
    await fs.writeFile(filePath, audioBuffer);
  }

  async existsAudio(lectureId, sceneId) {
    const filePath = path.join(this.audioBaseDir, lectureId, `scene-${sceneId}.wav`);
    return await fs.pathExists(filePath);
  }

  // 향후 영상 캡처 저장도 이곳에 추가하여 DRY를 실현함
  async saveCapture(lectureId, sceneId, videoBuffer) {
    // ...
  }
}

module.exports = new LectureRepository();
