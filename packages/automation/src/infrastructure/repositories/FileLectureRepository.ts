import * as fs from 'fs-extra';
import * as path from 'path';
import { config } from '../config';
import { AudioAlignment } from '../../domain/interfaces/IAudioProvider';
import { ILectureRepository } from '../../domain/interfaces/ILectureRepository';

export class FileLectureRepository implements ILectureRepository {
  private audioBaseDir = config.paths.audio;
  private captureBaseDir = config.paths.captures;
  private screenshotBaseDir = config.paths.screenshots;
  private stateCaptureBaseDir = path.join(path.dirname(config.paths.captures), 'state-captures');

  async saveAudio(lectureId: string, sceneId: number, audioBuffer: Buffer): Promise<void> {
    const dir = path.join(this.audioBaseDir, lectureId);
    await fs.ensureDir(dir);
    const filePath = path.join(dir, `scene-${sceneId}.wav`);
    await fs.writeFile(filePath, audioBuffer);
  }

  async existsAudio(lectureId: string, sceneId: number): Promise<boolean> {
    const filePath = path.join(this.audioBaseDir, lectureId, `scene-${sceneId}.wav`);
    return await fs.pathExists(filePath);
  }

  async existsCapture(lectureId: string, sceneId: number): Promise<boolean> {
    const filePath = path.join(this.captureBaseDir, lectureId, `scene-${sceneId}.webm`);
    return await fs.pathExists(filePath);
  }

  getCapturePath(lectureId: string, sceneId: number): string {
    return path.join(this.captureBaseDir, lectureId, `scene-${sceneId}.webm`);
  }

  async saveAudioDurations(lectureId: string, durations: Record<string, number>): Promise<void> {
    const dir = path.join(this.audioBaseDir, lectureId);
    await fs.ensureDir(dir);
    const filePath = path.join(dir, 'durations.json');
    await fs.writeJson(filePath, durations, { spaces: 2 });
  }

  async getAudioDuration(lectureId: string, sceneId: number): Promise<number | null> {
    const filePath = path.join(this.audioBaseDir, lectureId, `scene-${sceneId}.wav`);
    if (await fs.pathExists(filePath)) {
      const stats = await fs.stat(filePath);
      const videoConfig = config.getVideoConfig();
      const { sampleRate, channels, bitDepth } = videoConfig.audio;
      const bytesPerSecond = sampleRate * channels * (bitDepth / 8);
      return (stats.size - 44) / bytesPerSecond;
    }
    return null;
  }

  async getAudioDurations(lectureId: string): Promise<Record<string, number> | null> {
    const filePath = path.join(this.audioBaseDir, lectureId, 'durations.json');
    if (await fs.pathExists(filePath)) {
      return await fs.readJson(filePath);
    }
    return null;
  }

  async saveCapture(lectureId: string, sceneId: number, videoBuffer: Buffer): Promise<void> {
    const dir = path.join(this.captureBaseDir, lectureId);
    await fs.ensureDir(dir);
    const filePath = path.join(dir, `scene-${sceneId}.webm`);
    await fs.writeFile(filePath, videoBuffer);
  }

  async existsScreenshot(lectureId: string, sceneId: number): Promise<boolean> {
    const filePath = path.join(this.screenshotBaseDir, lectureId, `scene-${sceneId}.png`);
    return await fs.pathExists(filePath);
  }

  getScreenshotPath(lectureId: string, sceneId: number): string {
    return path.join(this.screenshotBaseDir, lectureId, `scene-${sceneId}.png`);
  }

  getAudioPath(lectureId: string, sceneId: number): string {
    return path.join(this.audioBaseDir, lectureId, `scene-${sceneId}.wav`);
  }

  async saveAlignment(lectureId: string, sceneId: number, alignment: AudioAlignment): Promise<void> {
    const dir = path.join(this.audioBaseDir, lectureId);
    await fs.ensureDir(dir);
    const filePath = path.join(dir, `scene-${sceneId}.alignment.json`);
    await fs.writeJson(filePath, alignment, { spaces: 2 });
  }

  async getAlignment(lectureId: string, sceneId: number): Promise<AudioAlignment | null> {
    const filePath = path.join(this.audioBaseDir, lectureId, `scene-${sceneId}.alignment.json`);
    if (await fs.pathExists(filePath)) {
      return await fs.readJson(filePath);
    }
    return null;
  }

  getSessionCaptureDir(lectureId: string, sessionId: string): string {
    return path.join(this.stateCaptureBaseDir, lectureId, `session-${sessionId}`);
  }

  getSessionSceneCaptureDir(lectureId: string, sessionId: string, sceneId: number): string {
    return path.join(this.getSessionCaptureDir(lectureId, sessionId), `scene-${sceneId}`);
  }
}
