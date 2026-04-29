import { Page } from 'playwright';
import { PlaywrightAction, PlaywrightCmd } from '../entities/Lecture';
import { StepData, CursorPosition } from '../entities/StepManifest';
import { ActionDurationEstimate } from './ActionTiming';

/**
 * Playwright 액션 핸들러 인터페이스 (#144 Phase 0d).
 *
 * 목적:
 *   - SSoT: 하나의 cmd 에 대한 모든 실행 모드와 lint 분류가 한 핸들러에 모인다.
 *   - SRP : 각 핸들러는 자기 cmd 의 책임만 진다. dispatch switch 가 사라진다.
 *   - OCP : 새 cmd 추가 = 새 핸들러 파일 + registry 한 줄. 기존 코드 수정 없음.
 *   - DIP : provider 들은 registry 인터페이스에만 의존. 구체 핸들러에 의존하지 않는다.
 *
 * 실행 모드:
 *   - executeForCapture  : state-capture (씬 단위 manifest step 생성)
 *   - executeForRecording: raw video (PlaywrightVisualProvider 의 webm 녹화)
 *   - executeOffscreen   : shared session 의 가변 대기 등 시각 효과 없는 실행
 *
 * 미지원 모드는 핸들러가 no-op 메서드로 명시적으로 표현한다 (silent skip 방지).
 */

export interface CaptureContext {
  stepIndex: number;
  outputDir: string;
  cursorPos: CursorPosition;
  /** ${capture:key} placeholder 치환 / capture·right_click 의 saveAs 기록에 사용 */
  lectureId?: string;
  /** capture 메타에 기록될 sceneId */
  sceneId?: number;
}

/**
 * 녹화 모드 컨텍스트.
 * provider 의 사적 도우미(injectCursor, resolveUrlFromScene 등) 를 콜백으로 주입해
 * 핸들러가 provider 클래스에 의존하지 않게 한다.
 */
export interface RecordContext {
  sceneId: number;
  lectureId?: string;
  outputPath?: string;
  hasStorageState?: boolean;
  /** goto / prefill_codepen 후 호출. 페이지에 커서 div 를 (재)주입한다. */
  injectCursor: () => Promise<void>;
  /** goto.urlFromScene 해석. 미해결 시 undefined. */
  resolveUrlFromScene: (sceneId: number) => string | undefined;
  /** goto 후 로그인 페이지 리다이렉트 감지. 만료 시 throw. */
  checkSessionExpired: (originalUrl: string) => void;
  /** wait_for_claude_ready: 녹화 모드는 timeout 시 warn + 계속 진행. */
  waitForClaudeReady: (timeoutMs: number) => Promise<void>;
}

export interface OffscreenContext {
  lectureId?: string;
  sceneId?: number;
}

/**
 * lint 룰이 사용할 메타데이터.
 *
 *   - isTeaching             : G-rule TEACHING_CMDS (drift 위험 큰 visible 학습 액션)
 *   - isForwardSyncPivotForbidden:
 *                              F-rule pivot 으로 부적합 (대기/이동 시간 비결정 또는 0).
 *                              syncPoint 를 이 cmd 에 두면 budget 분배가 깨진다.
 *   - isVisibleForwardSyncForbidden:
 *                              forward sync 씬에서 visible(offscreen=false) 로 두면
 *                              실제 수십초 지연이 budget 에서 빠져 sync 가 어긋남.
 *
 * 본 메타데이터의 SSoT 는 `PlaywrightCmdMetadata.ts`. 핸들러는 메타데이터를 직접 들고 다니지 않고,
 * lint 룰은 그쪽 SSoT 에서 cmd set 을 도출한다.
 */
export interface ActionLintMetadata {
  readonly isTeaching: boolean;
  readonly isForwardSyncPivotForbidden: boolean;
  readonly isVisibleForwardSyncForbidden: boolean;
}

export interface PlaywrightActionHandler {
  readonly cmd: PlaywrightCmd;
  estimateDurationMs(action: PlaywrightAction): ActionDurationEstimate;
  executeForCapture(page: Page, action: PlaywrightAction, ctx: CaptureContext): Promise<StepData | null>;
  executeForRecording(page: Page, action: PlaywrightAction, ctx: RecordContext): Promise<void>;
  executeOffscreen(page: Page, action: PlaywrightAction, ctx: OffscreenContext): Promise<void>;
}
