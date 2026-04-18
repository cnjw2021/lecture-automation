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
} from '../../domain/interfaces/ISharedVisualSessionProvider';
import { executeActionOffscreen, executeAndCaptureStep } from './playwrightStepExecutor';

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

    const storageStatePath = this.resolveStorageState(plan.storageState);

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      viewport: { width, height },
      deviceScaleFactor: 1,
      locale: 'ja-JP',
      timezoneId: 'Asia/Tokyo',
      colorScheme: 'light',
      reducedMotion: 'no-preference',
      ...(storageStatePath ? { storageState: storageStatePath } : {}),
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
  ): Promise<SceneManifest | null> {
    const session = this.requireSession(handle.sessionId);
    if (scene.visual.type !== 'playwright') return null;

    const visual = scene.visual as PlaywrightVisual;
    const videoConfig = config.getVideoConfig();
    const { width, height } = videoConfig.resolution;

    await fs.ensureDir(outputDir);

    const steps: StepData[] = [];
    let stepIndex = 0;
    console.log(`- [${session.plan.sessionId}] Scene ${scene.scene_id} 공유 세션 캡처 시작 (offscreen: ${visual.action.filter(a => a.offscreen).length}개, visible: ${visual.action.filter(a => !a.offscreen).length}개)`);

    try {
      for (const action of visual.action) {
        try {
          if (action.offscreen) {
            await executeActionOffscreen(session.page, action);
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
          console.warn(`  ⚠️ Action '${action.cmd}' 처리 실패: ${err.message}`);
        }
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
      const manifest: SceneManifest = {
        sceneId: scene.scene_id,
        lectureId: session.plan.lectureId,
        totalSteps: steps.length,
        totalDurationMs,
        viewport: { width, height },
        steps,
      };

      await fs.writeJson(path.join(outputDir, 'manifest.json'), manifest, { spaces: 2 });
      console.log(`  > Scene ${scene.scene_id} 공유 세션 캡처 완료: ${steps.length}개 step, ${totalDurationMs}ms`);
      return manifest;
    } catch (err: any) {
      console.error(`  > Scene ${scene.scene_id} 공유 세션 캡처 에러:`, err.message);
      return null;
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

  private resolveStorageState(storageState?: string): string | undefined {
    if (!storageState) return undefined;
    const resolved = path.resolve(config.paths.root, storageState);
    if (!fs.existsSync(resolved)) {
      console.warn(`  ⚠️ storageState 파일 없음: ${resolved} (인증 없이 진행)`);
      return undefined;
    }
    return resolved;
  }
}
