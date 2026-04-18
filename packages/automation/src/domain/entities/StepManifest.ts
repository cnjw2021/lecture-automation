/**
 * 상태 합성형(screenshot 기반) Playwright 씬의 step별 캡처 데이터.
 * PlaywrightStateCaptureProvider가 생성하고, Remotion PlaywrightSynthScene이 소비한다.
 */

export interface CursorPosition {
  x: number;
  y: number;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * ⚠️ index 축 주의:
 *  - PlaywrightVisual.action[] の index → raw action 배열 0-based (offscreen 포함)
 *  - StepData.index (아래) → visible-only 순차값 (offscreen 제외, 0부터 증가)
 *
 * syncPoints.actionIndex 와 RecordingManifest.actionTimestamps[].index 는 raw 기준,
 * SceneManifest.steps[].index 는 visible-only 기준이므로 서로 교차 참조하지 않는다.
 */
export interface StepData {
  /** visible step 인덱스 (0부터). offscreen 액션은 포함되지 않는다. */
  index: number;
  /** 원본 PlaywrightAction cmd */
  cmd: string;
  /** step 시작 시 스크린샷 파일명 (예: "step-0.png") */
  screenshot: string;
  /** 커서 시작 위치 */
  cursorFrom?: CursorPosition;
  /** 커서 종료 위치 */
  cursorTo?: CursorPosition;
  /** 대상 요소의 bounding box */
  targetBox?: BoundingBox;
  /** 입력 텍스트 (type cmd) */
  typedText?: string;
  /** 스크롤 위치 */
  scrollY?: number;
  /** 연출용 지속 시간 (ms) — Remotion에서 이 시간만큼 해당 step을 표시 */
  durationMs: number;
  /** 클릭 여부 (클릭 이펙트 렌더링용) */
  isClick?: boolean;
  /** 하이라이트 대상 여부 */
  isHighlight?: boolean;
  /** 부가 정보 (note 등) */
  note?: string;
}

export interface SceneManifest {
  /** 씬 ID */
  sceneId: number;
  /** 강의 ID */
  lectureId: string;
  /** 총 step 수 */
  totalSteps: number;
  /** 총 duration (ms) */
  totalDurationMs: number;
  /** 뷰포트 */
  viewport: { width: number; height: number };
  /** step별 데이터 */
  steps: StepData[];
  /**
   * 스크린샷 파일의 Remotion public 루트 기준 상대 경로.
   * 없으면 PlaywrightSynthScene이 기본값 `state-captures/{lectureId}/scene-{sceneId}` 를 사용.
   * 공유 세션(P-D) 캡처는 session 하위 경로에 기록되므로 이 필드를 반드시 설정한다.
   */
  captureBasePath?: string;
}
