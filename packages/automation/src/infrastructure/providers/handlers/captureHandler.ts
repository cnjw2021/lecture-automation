import {
  PlaywrightActionHandler,
  CaptureContext,
  RecordContext,
  OffscreenContext,
} from '../../../domain/playwright/PlaywrightActionHandler';
import { estimatePlaywrightActionDurationMs } from '../../../domain/playwright/ActionTiming';
import { applyCaptureTransform, readCaptureSourceValue } from '../playwrightCaptureExtractor';
import { saveCapture } from '../playwrightCaptureStore';

async function performCapture(
  page: any,
  action: any,
  lectureId: string,
  sceneId: number | undefined,
  logPrefix?: string,
): Promise<void> {
  const raw = await readCaptureSourceValue(page, {
    selector: action.selector,
    attribute: action.attribute,
    fromUrl: action.fromUrl,
  });
  const transformed = applyCaptureTransform(raw, action.transform);
  await saveCapture(lectureId, action.saveAs, transformed, {
    sceneId,
    sourceCmd: 'capture',
  });
  if (logPrefix) {
    console.log(`${logPrefix}${action.saveAs} = ${transformed.slice(0, 80)}`);
  }
}

export const captureHandler: PlaywrightActionHandler = {
  cmd: 'capture',
  estimateDurationMs: estimatePlaywrightActionDurationMs,

  async executeForCapture(page, action, ctx: CaptureContext) {
    if (!action.saveAs) {
      console.warn(`  ⚠️ capture 액션에 saveAs 가 없습니다 (스킵)`);
      return null;
    }
    if (!ctx.lectureId) {
      throw new Error(
        `capture 액션 실행에는 lectureId 가 필요합니다 (saveAs=${action.saveAs}, sceneId=${ctx.sceneId ?? '?'})`,
      );
    }
    await performCapture(page, action, ctx.lectureId, ctx.sceneId);
    // capture 는 시각 효과가 없으므로 manifest step 을 만들지 않는다.
    return null;
  },

  async executeForRecording(page, action, ctx: RecordContext) {
    if (!action.saveAs) {
      console.warn(`  ⚠️ capture 액션에 saveAs 가 없습니다 (스킵)`);
      return;
    }
    if (!ctx.lectureId) {
      throw new Error(
        `capture 액션 실행에는 lectureId 가 필요합니다 (saveAs=${action.saveAs}, sceneId=${ctx.sceneId})`,
      );
    }
    await performCapture(page, action, ctx.lectureId, ctx.sceneId, '  > capture: ');
  },

  async executeOffscreen(page, action, ctx: OffscreenContext) {
    // 페이지 상태 추출은 offscreen 에서도 동일하게 수행 (시각 효과 없음)
    if (!action.saveAs) return;
    if (!ctx.lectureId) {
      throw new Error(
        `capture 액션 실행에는 lectureId 가 필요합니다 (saveAs=${action.saveAs})`,
      );
    }
    await performCapture(page, action, ctx.lectureId, ctx.sceneId);
  },
};
