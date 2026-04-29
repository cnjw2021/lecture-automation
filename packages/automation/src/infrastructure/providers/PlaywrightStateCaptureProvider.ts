import { chromium } from 'playwright';
import * as path from 'path';
import * as fs from 'fs-extra';
import { config } from '../config';
import { Scene, PlaywrightVisual } from '../../domain/entities/Lecture';
import { SceneManifest, StepData, CursorPosition } from '../../domain/entities/StepManifest';
import { executeAndCaptureStep } from './playwrightStepExecutor';

/**
 * 상태 합성형(isolated) Playwright 캡처 프로바이더.
 * 씬마다 독립 컨텍스트를 열고 닫는다. 공유 세션(P-D)은 SharedPlaywrightStateCaptureProvider 참조.
 */
export class PlaywrightStateCaptureProvider {
  async capture(scene: Scene, outputDir: string, lectureId?: string): Promise<SceneManifest | null> {
    if (scene.visual.type !== 'playwright') return null;

    const visualConfig = scene.visual as PlaywrightVisual;
    const videoConfig = config.getVideoConfig();
    const { width, height } = videoConfig.resolution;

    await fs.ensureDir(outputDir);

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      viewport: { width, height },
      deviceScaleFactor: 1,
      locale: 'ja-JP',
      timezoneId: 'Asia/Tokyo',
      colorScheme: 'light',
      reducedMotion: 'no-preference',
    });

    const page = await context.newPage();
    const steps: StepData[] = [];
    let cursorPos: CursorPosition = { x: -100, y: -100 };
    let stepIndex = 0;

    try {
      console.log(`- Scene ${scene.scene_id} 상태 합성형 캡처 시작...`);

      for (const action of visualConfig.action) {
        try {
          const stepData = await executeAndCaptureStep(page, action, {
            stepIndex,
            outputDir,
            cursorPos,
            lectureId,
            sceneId: scene.scene_id,
          });

          if (stepData) {
            steps.push(stepData);
            if (stepData.cursorTo) {
              cursorPos = stepData.cursorTo;
            }
            stepIndex++;
          }
        } catch (actionError: any) {
          console.warn(`  ⚠️ Action '${action.cmd}' 캡처 실패: ${actionError.message}`);
        }
      }

      const finalScreenshot = `step-${stepIndex}.png`;
      await page.screenshot({ path: path.join(outputDir, finalScreenshot) });
      steps.push({
        index: stepIndex,
        cmd: 'final',
        screenshot: finalScreenshot,
        cursorFrom: cursorPos,
        cursorTo: cursorPos,
        durationMs: 500,
      });

      const totalDurationMs = steps.reduce((sum, s) => sum + s.durationMs, 0);

      const manifest: SceneManifest = {
        sceneId: scene.scene_id,
        lectureId: lectureId ?? '',
        totalSteps: steps.length,
        totalDurationMs,
        viewport: { width, height },
        steps,
      };

      await fs.writeJson(path.join(outputDir, 'manifest.json'), manifest, { spaces: 2 });
      console.log(`  > Scene ${scene.scene_id} 합성 캡처 완료: ${steps.length}개 step, ${totalDurationMs}ms`);

      return manifest;
    } catch (error: any) {
      console.error(`  > Scene ${scene.scene_id} 합성 캡처 중 에러:`, error.message);
      return null;
    } finally {
      await context.close();
      await browser.close();
    }
  }
}
