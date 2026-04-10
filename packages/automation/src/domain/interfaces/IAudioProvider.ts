export interface GenerateAudioOptions {
  scene_id?: number;
}

/** TTS 문자 단위 타임스탬프 (ElevenLabs with-timestamps 등) */
export interface AudioAlignment {
  characters: string[];
  character_start_times_seconds: number[];
  character_end_times_seconds: number[];
}

export interface AudioGenerateResult {
  buffer: Buffer;
  durationSec: number;
  /** 문자 단위 타임스탬프. TTS 프로바이더가 지원하는 경우에만 포함. */
  alignment?: AudioAlignment;
}

export interface AudioConfig {
  sampleRate: number;
  channels: number;
  bitDepth: number;
  speechRate: number;
}

export interface IAudioProvider {
  generate(text: string, options?: GenerateAudioOptions): Promise<AudioGenerateResult>;
}
