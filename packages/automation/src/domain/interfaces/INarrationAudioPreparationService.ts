import { Lecture } from '../entities/Lecture';

export interface NarrationAudioPreparationParams {
  lecture: Lecture;
  jsonFileName: string;
  lecturePath: string;
  forceRegenerate: boolean;
  targetSceneIds?: number[];
  /**
   * 청크 단위 재생성(이슈 #113). scene_id → chunkIndex[] 매핑.
   * 지정된 씬의 해당 청크만 삭제 후 재생성하고 다른 청크는 기존 파일을 재사용한다.
   * targetSceneIds 와 함께 사용한다.
   */
  targetChunks?: Record<number, number[]>;
}

export interface NarrationAudioPreparationResult {
  source: 'tts';
  providerName?: string;
}

export interface INarrationAudioPreparationService {
  prepare(params: NarrationAudioPreparationParams): Promise<NarrationAudioPreparationResult>;
}
