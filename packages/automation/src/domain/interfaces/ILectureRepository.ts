import { AudioAlignment } from './IAudioProvider';

export interface ILectureRepository {
  saveAudio(lectureId: string, sceneId: number, audioBuffer: Buffer): Promise<void>;
  existsAudio(lectureId: string, sceneId: number): Promise<boolean>;
  existsCapture(lectureId: string, sceneId: number): Promise<boolean>;
  saveAudioDurations(lectureId: string, durations: Record<string, number>): Promise<void>;
  getAudioDuration(lectureId: string, sceneId: number): Promise<number | null>;
  getAudioDurations(lectureId: string): Promise<Record<string, number> | null>;
  saveCapture(lectureId: string, sceneId: number, videoBuffer: Buffer): Promise<void>;
  getCapturePath(lectureId: string, sceneId: number): string;
  existsScreenshot(lectureId: string, sceneId: number): Promise<boolean>;
  getScreenshotPath(lectureId: string, sceneId: number): string;
  getAudioPath(lectureId: string, sceneId: number): string;
  saveAlignment(lectureId: string, sceneId: number, alignment: AudioAlignment): Promise<void>;
  getAlignment(lectureId: string, sceneId: number): Promise<AudioAlignment | null>;
  /** 공유 세션(P-D) 씬의 state capture 루트. session-{sessionId}/scene-{sceneId}/ 를 감싸는 상위 디렉토리. */
  getSessionCaptureDir(lectureId: string, sessionId: string): string;
  /** 공유 세션 내 특정 씬의 state capture 디렉토리. */
  getSessionSceneCaptureDir(lectureId: string, sessionId: string, sceneId: number): string;

  // ---------------------------------------------------------------------------
  // 씬 내부 TTS 청크 (이슈 #113)
  //
  // 씬 하나의 나레이션을 여러 청크로 쪼개 각각 TTS 생성한 뒤 concat 하는 경로용.
  // 파일 규약:
  //   - scene-{sceneId}-chunk-{chunkIndex}.wav           (청크 오디오)
  //   - scene-{sceneId}-chunk-{chunkIndex}.alignment.json (청크 alignment, 선택)
  // chunkIndex 는 0 부터 시작.
  // ---------------------------------------------------------------------------
  saveAudioChunk(lectureId: string, sceneId: number, chunkIndex: number, audioBuffer: Buffer): Promise<void>;
  existsAudioChunk(lectureId: string, sceneId: number, chunkIndex: number): Promise<boolean>;
  getAudioChunkPath(lectureId: string, sceneId: number, chunkIndex: number): string;
  deleteAudioChunk(lectureId: string, sceneId: number, chunkIndex: number): Promise<void>;
  loadAudioChunk(lectureId: string, sceneId: number, chunkIndex: number): Promise<Buffer | null>;
  saveAudioChunkAlignment(lectureId: string, sceneId: number, chunkIndex: number, alignment: AudioAlignment): Promise<void>;
  getAudioChunkAlignment(lectureId: string, sceneId: number, chunkIndex: number): Promise<AudioAlignment | null>;
  /**
   * 해당 씬에 현재 저장되어 있는 청크 인덱스 목록을 오름차순으로 반환.
   * 청크 파일이 하나도 없으면 빈 배열 반환.
   */
  listAudioChunkIndices(lectureId: string, sceneId: number): Promise<number[]>;
}
