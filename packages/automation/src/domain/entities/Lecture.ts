import { VisualStylePreset } from '../visual-style/VisualStylePreset';

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
  | 'render_code_block' // 페이지 내 마지막 코드 블록을 추출하여 새 탭에서 렌더
  | 'wait_for_claude_ready' // Claude 응답 완료까지 폴링 대기 (timeout 기본 180000ms)
  | 'prefill_codepen';      // CodePen Prefill API 로 사전 입력된 콘텐츠로 신규 pen 생성·이동 (goto 대체)

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
  /**
   * 공유 세션(P-D) 전용: true 이면 실제 세션에서 실행되지만
   * 씬 캡처(manifest step)와 씬 길이 계산에서 제외된다.
   * wait_for_claude_ready, 세션 재개 후 DOM 정착 wait 등 비결정적 대기에 사용.
   */
  offscreen?: boolean;
  /** prefill_codepen: HTML 에디터 초기 콘텐츠 */
  html?: string;
  /** prefill_codepen: CSS 에디터 초기 콘텐츠 */
  css?: string;
  /** prefill_codepen: JS 에디터 초기 콘텐츠 */
  js?: string;
  /** prefill_codepen: editors 표시 패턴 (예: "100" = HTML 만 보이기, "111" = 모두). 미지정 시 CodePen 기본값 */
  editors?: string;
}

/**
 * Playwright 씬의 실행 단위 설정.
 * - isolated: 씬마다 독립된 browser/context/page 사용 (기본 동작, 현행 호환)
 * - shared  : 같은 session.id 를 공유하는 인접/연관 씬들이 하나의 page 인스턴스를 공유
 *             결과 확인 씬은 goto 재진입이 아니라 "이어받기" 로 동작해야 한다
 */
export interface PlaywrightSessionConfig {
  id: string;
  mode: 'isolated' | 'shared';
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
  /** Optional #128 style preset. Missing values use the configured default preset policy. */
  stylePreset?: VisualStylePreset;
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
  /** Optional #128 style preset. Missing values use the configured default preset policy. */
  stylePreset?: VisualStylePreset;
  /** 정의된 경우 sync-playwright 커맨드로 wait ms를 자동 재계산한다. */
  syncPoints?: PlaywrightSyncPoint[];
  transition?: TransitionConfig;
  /** 브라우저 인증 상태 파일 경로 (예: "config/auth/claude.json"). 프로젝트 루트 상대 경로. */
  storageState?: string;
  /**
   * 공유 세션(P-D) 설정. 생략 시 isolated 로 간주.
   * 같은 session.id + mode 'shared' 인 씬들은 하나의 LiveDemoSession 으로 그룹핑되어
   * browser/context/page 가 세션 동안 유지된다.
   */
  session?: PlaywrightSessionConfig;
}

export interface ScreenshotVisual {
  type: 'screenshot';
  url: string;
  title?: string;
  description?: string;
  layout?: 'left' | 'right' | 'full';
  /** Optional #128 style preset. Missing values use the configured default preset policy. */
  stylePreset?: VisualStylePreset;
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
  /** 씬의 선언된 길이(초). docs SSoT 기준 1초 ≒ 5.5자(일본어). */
  durationSec?: number;
  visual: VisualConfig;
}

export interface Lecture {
  lecture_id: string;
  metadata: Metadata;
  sequence: Scene[];
}
