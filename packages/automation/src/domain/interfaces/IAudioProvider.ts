export interface GenerateAudioOptions {
  scene_id?: number;
}

export interface AudioGenerateResult {
  buffer: Buffer;
  durationSec: number;
}

export interface IAudioProvider {
  generate(text: string, options?: GenerateAudioOptions): Promise<AudioGenerateResult>;
}
