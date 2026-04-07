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
  | 'select_devtools_node' // DevTools 트리에서 실제 DOM 노드 선택
  | 'toggle_devtools_node' // DevTools 트리 노드 펼침/접힘
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
  mode?: 'toggle' | 'expand' | 'collapse';
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

/**
 * Playwright 씬의 나레이션-액션 싱크 포인트.
 * actionIndex 번 액션이 narration 내 phrase 발화 시점에 맞춰 실행되도록 wait를 자동 조정한다.
 * phrase는 나레이션 안에서 유일하게 특정되는 부분 문자열이어야 한다.
 */
export interface PlaywrightSyncPoint {
  actionIndex: number;  // actions 배열의 인덱스 (0-based)
  phrase: string;       // 이 액션이 발화되어야 할 나레이션 구절 (나레이션 내 고유 부분문자열)
}

export interface PlaywrightVisual {
  type: 'playwright';
  action: PlaywrightAction[];
  /** 정의된 경우 sync-playwright 커맨드로 wait ms를 자동 재계산한다. */
  syncPoints?: PlaywrightSyncPoint[];
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
