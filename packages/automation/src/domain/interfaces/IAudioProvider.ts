import { Scene, Metadata } from '../entities/Lecture';

export interface GenerateAudioOptions {
  scene_id?: number;
  metadata?: Metadata;
}

export interface AudioGenerateResult {
  buffer: Buffer;
  durationSec: number;
}

export interface IAudioProvider {
  generate(text: string, options?: GenerateAudioOptions): Promise<AudioGenerateResult>;
}
