import { Page } from 'playwright';
import { PlaywrightAction } from '../../domain/entities/Lecture';
import { StepData, CursorPosition } from '../../domain/entities/StepManifest';
import { expandActionPlaceholders } from './playwrightCaptureStore';
import { getActionHandler } from './handlers';

/**
 * Playwright 액션을 실행하고 그 결과를 합성 캡처용 StepData 로 환원한다.
 *
 * SSoT 목적:
 *   - PlaywrightStateCaptureProvider (씬 단위)
 *   - SharedPlaywrightStateCaptureProvider (세션 단위)
 * 두 프로바이더가 같은 액션 실행/캡처 로직을 공유하도록 하나의 순수 모듈로 분리.
 *
 * #144 Phase 0d 이후로는 액션별 실행 로직을 PlaywrightActionRegistry 의
 * 핸들러에 위임한다. 본 함수는 placeholder 치환과 dispatch 만 담당한다.
 *
 * offscreen 액션(공유 세션의 가변 대기 등)은 executeOffscreen 으로 별도 처리한다.
 */

export interface StepCaptureContext {
  stepIndex: number;
  outputDir: string;
  cursorPos: CursorPosition;
  /**
   * ${capture:key} placeholder 치환 및 capture/right_click 액션의 saveAs 저장에 사용.
   * 빈 문자열 또는 미지정이면 placeholder 가 있을 경우 strict 모드로 throw.
   */
  lectureId?: string;
  /** capture 액션 실행 시 saveAs 메타에 기록될 sceneId */
  sceneId?: number;
}

export async function executeAndCaptureStep(
  page: Page,
  rawAction: PlaywrightAction,
  ctx: StepCaptureContext,
): Promise<StepData | null> {
  const action = await expandActionPlaceholders(rawAction, ctx.lectureId);
  const handler = getActionHandler(action.cmd);
  if (!handler) {
    console.warn(`  ⚠️ 미지원 Action '${action.cmd}' (건너뜀)`);
    return null;
  }
  return handler.executeForCapture(page, action, ctx);
}

/**
 * offscreen 액션: 실제 세션에서 실행만 하고 캡처 step 은 생성하지 않는다.
 * 공유 세션(P-D)에서 LLM 응답 대기 등 가변 지연을 씬 바깥으로 밀어낼 때 사용.
 */
export interface OffscreenContext {
  lectureId?: string;
  sceneId?: number;
}

export async function executeActionOffscreen(
  page: Page,
  rawAction: PlaywrightAction,
  ctx: OffscreenContext = {},
): Promise<void> {
  const action = await expandActionPlaceholders(rawAction, ctx.lectureId);
  const handler = getActionHandler(action.cmd);
  if (!handler) {
    console.warn(`  ⚠️ offscreen 미지원 Action '${action.cmd}' (건너뜀)`);
    return;
  }
  await handler.executeOffscreen(page, action, ctx);
}
