export interface Metadata {
  title: string;
  target_duration: string;
  target_audience: string;
}

/** 사용 가능한 Playwright 액션 명령어 목록. 상세 명세: docs/playwright-actions.md */
export type PlaywrightCmd =
  | 'goto'         // URL 이동 (페이지 로드 후 커서 자동 주입)
  | 'wait'         // 대기 (ms)
  | 'mouse_move'   // 마우스 이동 (to: [x, y])
  | 'click'        // 요소 클릭 (selector)
  | 'type'         // 텍스트 입력 (selector, key)
  | 'press'        // 키보드 키 입력 (key)
  | 'focus'        // 요소 포커스 (selector)
  | 'mouse_drag'   // 마우스 드래그 (from, to)
  | 'highlight'    // 요소 분홍 아웃라인 강조 (selector)
  | 'open_devtools' // Chrome DevTools 오버레이 주입
  | 'disable_css'  // 모든 스타일시트 비활성화
  | 'enable_css';  // 스타일시트 복원

export interface PlaywrightAction {
  cmd: PlaywrightCmd;
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
  animation?: Record<string, any>;
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
