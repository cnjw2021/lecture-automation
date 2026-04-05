export interface Metadata {
  title: string;
  target_duration: string;
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

export interface TransitionConfig {
  enter?: 'fade' | 'slide-left' | 'slide-up' | 'zoom' | 'none';
  exit?: 'fade' | 'slide-right' | 'slide-down' | 'zoom' | 'none';
  durationFrames?: number;
}

export interface RemotionVisual {
  type: 'remotion';
  component: string;
  props: Record<string, any>;
  transition?: TransitionConfig;
}

export interface PlaywrightVisual {
  type: 'playwright';
  action: PlaywrightAction[];
  transition?: TransitionConfig;
}

export interface ScreenshotVisual {
  type: 'screenshot';
  url: string;
  title?: string;
  description?: string;
  layout?: 'left' | 'right' | 'full';
  waitMs?: number;
  transition?: TransitionConfig;
}

export type VisualConfig = RemotionVisual | PlaywrightVisual | ScreenshotVisual;

export interface Scene {
  scene_id: number;
  timestamp?: string;
  title?: string;
  narration: string;
  visual: VisualConfig;
}

export interface Lecture {
  lecture_id: string;
  metadata: Metadata;
  sequence: Scene[];
}
