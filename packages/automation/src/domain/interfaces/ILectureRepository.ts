export interface ILectureRepository {
  saveAudio(lectureId: string, sceneId: number, audioBuffer: Buffer): Promise<void>;
  existsAudio(lectureId: string, sceneId: number): Promise<boolean>;
  existsCapture(lectureId: string, sceneId: number): Promise<boolean>;
  saveAudioDurations(lectureId: string, durations: Record<string, number>): Promise<void>;
  getAudioDuration(lectureId: string, sceneId: number): Promise<number | null>;
  getAudioDurations(lectureId: string): Promise<Record<string, number> | null>;
  saveCapture(lectureId: string, sceneId: number, videoBuffer: Buffer): Promise<void>;
  getCapturePath(lectureId: string, sceneId: number): string;
}
