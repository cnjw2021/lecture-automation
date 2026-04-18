import { Browser, BrowserContext, chromium, Page } from 'playwright';
import * as path from 'path';
import * as fs from 'fs-extra';
import { config } from '../config';
import { Scene, PlaywrightVisual } from '../../domain/entities/Lecture';
import { SceneManifest, StepData, CursorPosition } from '../../domain/entities/StepManifest';
import {
  ISharedVisualSessionProvider,
  LiveDemoSessionPlan,
  SharedVisualSessionHandle,
  CaptureSceneOptions,
} from '../../domain/interfaces/ISharedVisualSessionProvider';
import { executeActionOffscreen, executeAndCaptureStep } from './playwrightStepExecutor';
import { resolveStorageState, buildLaunchOptions, preflightCloseSidebar } from './playwrightBrowserUtils';

/**
 * 공유 브라우저 세션(P-D) 기반 상태 합성형 캡처 프로바이더.
 *
 * 한 세션 = 하나의 browser/context/page 생명주기.
 * 같은 세션 내 씬들은 같은 page 를 이어받으며, 씬마다 별도 매니페스트/스크린샷을 출력한다.
 *
 * offscreen=true 액션은 page 에 영향을 주되 씬 매니페스트에는 step 으로 기록하지 않음.
 * → LLM 응답 대기 등 가변 지연을 클립 길이 바깥으로 추방하는 핵심 메커니즘.
 */
interface InternalSession {
  plan: LiveDemoSessionPlan;
  browser: Browser;
  context: BrowserContext;
  page: Page;
  startedAt: string;
  cursorPos: CursorPosition;
}

export class SharedPlaywrightStateCaptureProvider implements ISharedVisualSessionProvider {
  private sessions = new Map<string, InternalSession>();

  async openSession(plan: LiveDemoSessionPlan): Promise<SharedVisualSessionHandle> {
    if (this.sessions.has(plan.sessionId)) {
      throw new Error(`[SharedSession] 이미 열려있는 세션: ${plan.sessionId}`);
    }

    const videoConfig = config.getVideoConfig();
    const { width, height } = videoConfig.resolution;

    const storageStatePath = resolveStorageState(plan.storageState);
    const launchOptions = buildLaunchOptions(!!storageStatePath);

    // storageState 씬: 사이드바 닫힌 상태의 storageState 준비 (Cloudflare 봇 감지 우회 필수)
    let effectiveStorageState = storageStatePath;
    if (storageStatePath) {
      effectiveStorageState = await preflightCloseSidebar(launchOptions, storageStatePath, width, height);
    }

    const browser = await chromium.launch(launchOptions);
    const context = await browser.newContext({
      viewport: { width, height },
      deviceScaleFactor: 1,
      locale: 'ja-JP',
      timezoneId: 'Asia/Tokyo',
      colorScheme: 'light',
      reducedMotion: 'no-preference',
      ...(effectiveStorageState ? { storageState: effectiveStorageState } : {}),
    });

    const page = await context.newPage();

    const session: InternalSession = {
      plan,
      browser,
      context,
      page,
      startedAt: new Date().toISOString(),
      cursorPos: { x: -100, y: -100 },
    };
    this.sessions.set(plan.sessionId, session);

    const sessionDir = this.getSessionDir(plan);
    await fs.ensureDir(sessionDir);
    console.log(`[SharedSession] ${plan.sessionId} 오픈 (씬 ${plan.sceneIds.join(', ')})`);

    return { sessionId: plan.sessionId };
  }

  async captureSceneInSession(
    handle: SharedVisualSessionHandle,
    scene: Scene,
    outputDir: string,
    options?: CaptureSceneOptions,
  ): Promise<SceneManifest | null> {
    const { replayOnly = false } = options ?? {};
    const session = this.requireSession(handle.sessionId);
    if (scene.visual.type !== 'playwright') return null;

    const visual = scene.visual as PlaywrightVisual;
    const videoConfig = config.getVideoConfig();
    const { width, height } = videoConfig.resolution;

    if (!replayOnly) {
      await fs.ensureDir(outputDir);
    }

    const steps: StepData[] = [];
    let stepIndex = 0;

    if (replayOnly) {
      console.log(`- [${session.plan.sessionId}] Scene ${scene.scene_id} 리플레이 (페이지 상태 복원)`);
    } else {
      console.log(`- [${session.plan.sessionId}] Scene ${scene.scene_id} 공유 세션 캡처 시작 (offscreen: ${visual.action.filter(a => a.offscreen).length}개, visible: ${visual.action.filter(a => !a.offscreen).length}개)`);
    }

    try {
      for (const action of visual.action) {
        try {
          // replayOnly 모드: 모든 액션을 offscreen처럼 처리 (스크린샷 없음)
          if (replayOnly || action.offscreen) {
            // selector 기반 액션(click/type/focus)은 실행 전 bounding box 중심을 커서로 기록한다.
            // full run의 executeAndCaptureStep도 실행 전 box를 캡처하므로 동일 타이밍이다.
            const selectorCmd = action.cmd === 'click' || action.cmd === 'type' || action.cmd === 'focus';
            let selectorBox: { x: number; y: number; width: number; height: number } | null = null;
            if (selectorCmd && action.selector) {
              try {
                selectorBox = await session.page.locator(action.selector).boundingBox();
              } catch (_) {}
            }

            await executeActionOffscreen(session.page, action);

            if (action.cmd === 'mouse_move' && action.to) {
              session.cursorPos = { x: action.to[0], y: action.to[1] };
            } else if (action.cmd === 'mouse_drag' && action.to) {
              session.cursorPos = { x: action.to[0], y: action.to[1] };
            } else if (selectorBox) {
              session.cursorPos = { x: selectorBox.x + selectorBox.width / 2, y: selectorBox.y + selectorBox.height / 2 };
            }
            continue;
          }
          const stepData = await executeAndCaptureStep(session.page, action, {
            stepIndex,
            outputDir,
            cursorPos: session.cursorPos,
          });
          if (!stepData) continue;
          steps.push(stepData);
          if (stepData.cursorTo) session.cursorPos = stepData.cursorTo;
          stepIndex++;
        } catch (err: any) {
          // shared session: 액션 실패 = 페이지 상태 파괴 → replayOnly/capture 모두 즉시 중단
          throw err;
        }
      }

      if (replayOnly) {
        console.log(`  > Scene ${scene.scene_id} 리플레이 완료`);
        return null;
      }

      const finalScreenshot = `step-${stepIndex}.png`;
      await session.page.screenshot({ path: path.join(outputDir, finalScreenshot) });
      steps.push({
        index: stepIndex,
        cmd: 'final',
        screenshot: finalScreenshot,
        cursorFrom: session.cursorPos,
        cursorTo: session.cursorPos,
        durationMs: 500,
      });

      const totalDurationMs = steps.reduce((sum, s) => sum + s.durationMs, 0);

      // Remotion public 루트 기준 상대 경로 (PlaywrightSynthScene의 staticFile 해석 기준)
      const remotionPublicDir = path.dirname(config.paths.captures);
      const captureBasePath = path.relative(remotionPublicDir, outputDir);

      const manifest: SceneManifest = {
        sceneId: scene.scene_id,
        lectureId: session.plan.lectureId,
        totalSteps: steps.length,
        totalDurationMs,
        viewport: { width, height },
        steps,
        captureBasePath,
      };

      await fs.writeJson(path.join(outputDir, 'manifest.json'), manifest, { spaces: 2 });
      console.log(`  > Scene ${scene.scene_id} 공유 세션 캡처 완료: ${steps.length}개 step, ${totalDurationMs}ms`);
      return manifest;
    } catch (err: any) {
      // 액션 실패 또는 캡처 에러 모두 throw — shared session 내 어떤 실패도
      // 후속 씬의 page 상태를 오염시키므로 replayOnly/capture 구분 없이 즉시 중단한다.
      throw err;
    }
  }

  async closeSession(handle: SharedVisualSessionHandle): Promise<void> {
    const session = this.sessions.get(handle.sessionId);
    if (!session) return;

    const sessionDir = this.getSessionDir(session.plan);
    const sessionManifest = {
      lectureId: session.plan.lectureId,
      sessionId: session.plan.sessionId,
      sceneIds: session.plan.sceneIds,
      startedAt: session.startedAt,
      completedAt: new Date().toISOString(),
    };
    await fs.writeJson(path.join(sessionDir, 'session.manifest.json'), sessionManifest, { spaces: 2 });

    try {
      await session.context.close();
    } finally {
      await session.browser.close();
    }
    this.sessions.delete(handle.sessionId);
    console.log(`[SharedSession] ${handle.sessionId} 종료`);
  }

  private requireSession(sessionId: string): InternalSession {
    const s = this.sessions.get(sessionId);
    if (!s) throw new Error(`[SharedSession] 세션 미오픈: ${sessionId}`);
    return s;
  }

  private getSessionDir(plan: LiveDemoSessionPlan): string {
    const stateCaptureBaseDir = path.join(path.dirname(config.paths.captures), 'state-captures');
    return path.join(stateCaptureBaseDir, plan.lectureId, `session-${plan.sessionId}`);
  }
}
