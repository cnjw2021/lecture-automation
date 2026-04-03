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

  async existsCapture(lectureId, sceneId) {
    const filePath = path.join(this.captureBaseDir, lectureId, `scene-${sceneId}.webm`);
    return await fs.pathExists(filePath);
  }

  async saveAudioDurations(lectureId, durations) {
    const dir = path.join(this.audioBaseDir, lectureId);
    await fs.ensureDir(dir);
    const filePath = path.join(dir, 'durations.json');
    await fs.writeJson(filePath, durations, { spaces: 2 });
  }

  async getAudioDuration(lectureId, sceneId) {
    const filePath = path.join(this.audioBaseDir, lectureId, `scene-${sceneId}.wav`);
    if (await fs.pathExists(filePath)) {
      const stats = await fs.stat(filePath);
      // WAV 파일: duration = (fileSize - 44) / (sampleRate * channels * sampleWidth)
      // sampleRate=24000, channels=1, sampleWidth=2
      return (stats.size - 44) / 48000;
    }
    return null;
  }

  async getAudioDurations(lectureId) {
    const filePath = path.join(this.audioBaseDir, lectureId, 'durations.json');
    if (await fs.pathExists(filePath)) {
      return await fs.readJson(filePath);
    }
    return null;
  }

  // 향후 영상 캡처 저장도 이곳에 추가하여 DRY를 실현함
  async saveCapture(lectureId, sceneId, videoBuffer) {
    // ...
  }
}

module.exports = new LectureRepository();
