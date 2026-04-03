export interface Metadata {
  title: string;
  target_duration: string;
  language: string;
  voice_model: string;
  target_audience: string;
}

export interface PlaywrightAction {
  cmd: string;
  url?: string;
  ms?: number;
  selector?: string;
  from?: [number, number];
  to?: [number, number];
  key?: string;
  note?: string;
}

export interface RemotionVisual {
  type: 'remotion';
  component: string;
  props: Record<string, any>;
}

export interface PlaywrightVisual {
  type: 'playwright';
  action: PlaywrightAction[];
}

export type VisualConfig = RemotionVisual | PlaywrightVisual;

export interface Scene {
  scene_id: number;
  timestamp: string;
  title: string;
  narration: string;
  visual: VisualConfig;
}

export interface Lecture {
  lecture_id: string;
  metadata: Metadata;
  sequence: Scene[];
}
