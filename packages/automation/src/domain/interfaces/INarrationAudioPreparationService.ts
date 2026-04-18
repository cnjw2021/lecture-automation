import { Lecture } from '../entities/Lecture';

export interface NarrationAudioPreparationParams {
  lecture: Lecture;
  jsonFileName: string;
  lecturePath: string;
  forceRegenerate: boolean;
  targetSceneIds?: number[];
}

export interface NarrationAudioPreparationResult {
  source: 'tts';
  providerName?: string;
}

export interface INarrationAudioPreparationService {
  prepare(params: NarrationAudioPreparationParams): Promise<NarrationAudioPreparationResult>;
}
