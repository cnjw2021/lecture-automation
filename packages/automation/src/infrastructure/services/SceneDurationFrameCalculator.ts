import { config } from '../config';

export class SceneDurationFrameCalculator {
  getDurationFrames(sceneId: number, audioDurations: Record<string, number>): number {
    const videoConfig = config.getVideoConfig();
    const scenePaddingSec = videoConfig.scenePaddingSec ?? 0.5;
    const durationSec = audioDurations[sceneId.toString()] || 10;
    return Math.ceil((durationSec + scenePaddingSec) * videoConfig.fps);
  }
}
