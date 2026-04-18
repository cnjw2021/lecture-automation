export interface Metadata {
  title: string;
  target_duration: string;
  target_audience: string;
}

/** 사용 가능한 Playwright 액션 명령어 목록. 상세 명세: docs/playwright-actions.md */
export type PlaywrightCmd =
  | 'goto'         // URL 이동 (페이지 로드 후 커서 자동 주입)
  | 'wait'         // 대기 (ms)
  | 'wait_for'     // 셀렉터 대기 (selector, state, timeout) — setup 전용
  | 'scroll'       // 페이지 스크롤 (deltaY: 양수=아래, 음수=위)
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
  | 'enable_css'   // 스타일시트 복원
  | 'render_code_block'; // 페이지 내 마지막 코드 블록을 추출하여 새 탭에서 렌더

export interface PlaywrightAction {
  cmd: PlaywrightCmd;
  url?: string;
  /** goto: 지정된 이전 씬의 녹화 매니페스트에서 conversationUrl을 읽어 URL로 사용. url보다 우선. */
  urlFromScene?: number;
  ms?: number;
  selector?: string;
  from?: [number, number];
  to?: [number, number];
  key?: string;
  mode?: 'toggle' | 'expand' | 'collapse';
  note?: string;
  /** wait_for: 대기할 상태 (기본 'visible') */
  state?: 'visible' | 'hidden' | 'attached' | 'detached';
  /** wait_for: 타임아웃 ms (기본 30000) */
  timeout?: number;
  /** scroll: 스크롤 량 (양수=아래, 음수=위, 기본 300) */
  deltaY?: number;
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
 *
 * target (역방향 싱크 전용):
 *   - 'start' : 액션 시작 시각(startMs)에 phrase를 정렬 — 시각 효과가 액션 시작에서 발생
 *     (press/click/scroll/goto/mouse_move/type/highlight 등 대부분의 액션)
 *   - 'end'   : 액션 완료 시각(endMs)에 phrase를 정렬 — 조건/대기 충족 시점에 시각 효과 발생
 *     (wait_for — 조건 만족 시 화면 변화, wait — 시간 경과 후)
 *   - 미지정 시 액션 cmd 타입에 따른 기본값이 적용된다.
 */
export interface PlaywrightSyncPoint {
  actionIndex: number;  // actions 배열의 인덱스 (0-based)
  phrase: string;       // 이 액션이 발화되어야 할 나레이션 구절 (나레이션 내 고유 부분문자열)
  target?: 'start' | 'end';
}

export interface PlaywrightVisual {
  type: 'playwright';
  action: PlaywrightAction[];
  /** 정의된 경우 sync-playwright 커맨드로 wait ms를 자동 재계산한다. */
  syncPoints?: PlaywrightSyncPoint[];
  transition?: TransitionConfig;
  /** 브라우저 인증 상태 파일 경로 (예: "config/auth/claude.json"). 프로젝트 루트 상대 경로. */
  storageState?: string;
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
