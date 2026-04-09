import { chromium, Page } from 'playwright';
import * as path from 'path';
import * as fs from 'fs-extra';
import { config } from '../config';
import { IVisualProvider } from '../../domain/interfaces/IVisualProvider';
import { Scene, PlaywrightVisual, PlaywrightAction } from '../../domain/entities/Lecture';
import { executeEduDevtoolsAction, getEduDevtoolsActionDuration } from './playwrightEduDevtools';

/** 녹화 매니페스트: 각 액션의 실행 타임스탬프를 기록 */
export interface RecordingActionTimestamp {
  index: number;
  cmd: string;
  startMs: number;
  endMs: number;
}

export interface RecordingManifest {
  sceneId: number;
  totalDurationMs: number;
  actionTimestamps: RecordingActionTimestamp[];
}

export class PlaywrightVisualProvider implements IVisualProvider {
  async record(scene: Scene, outputPath: string): Promise<void> {
    if (scene.visual.type !== 'playwright') {
      return;
    }

    const visualConfig = scene.visual as PlaywrightVisual;
    const videoConfig = config.getVideoConfig();
    const { width, height } = videoConfig.resolution;
    const storageStatePath = this.resolveStorageState(visualConfig.storageState);

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      viewport: { width, height },
      deviceScaleFactor: 1,
      locale: 'ja-JP',
      timezoneId: 'Asia/Tokyo',
      colorScheme: 'light',
      reducedMotion: 'no-preference',
      recordVideo: {
        dir: path.dirname(outputPath),
        size: { width, height },
      },
      ...(storageStatePath ? { storageState: storageStatePath } : {}),
    });

    await context.tracing.start({ screenshots: true, snapshots: true });

    const page = await context.newPage();
    let hasError = false;

    try {
      console.log(`- Scene ${scene.scene_id} 녹화 시작...`);
      const { timestamps, totalDurationMs } = await this.executeActions(
        page, visualConfig.action, scene.scene_id, 'record',
        { hasStorageState: !!storageStatePath },
      );
      await page.waitForTimeout(2000);

      // 매니페스트 저장 (wait_for가 있는 라이브 데모 씬용)
      const hasWaitFor = visualConfig.action.some(a => a.cmd === 'wait_for');
      if (hasWaitFor) {
        const manifest: RecordingManifest = {
          sceneId: scene.scene_id,
          totalDurationMs: totalDurationMs + 2000,
          actionTimestamps: timestamps,
        };
        const manifestPath = outputPath.replace(/\.\w+$/, '.manifest.json');
        await fs.writeJson(manifestPath, manifest, { spaces: 2 });
        console.log(`  > 녹화 매니페스트 저장: ${manifestPath}`);
      }
    } catch (error: any) {
      hasError = true;
      console.error(`  > Scene ${scene.scene_id} 녹화 중 에러:`, error.message);
    } finally {
      if (hasError) {
        const traceDir = path.join(config.paths.output, 'traces');
        await fs.ensureDir(traceDir);
        const tracePath = path.join(traceDir, `scene-${scene.scene_id}.zip`);
        await context.tracing.stop({ path: tracePath });
        console.log(`  > Trace 저장됨: ${tracePath} (npx playwright show-trace ${tracePath} 로 분석)`);
      } else {
        await context.tracing.stop();
      }

      const video = page.video();
      const videoPath = video ? await video.path() : null;
      await context.close();
      await browser.close();

      if (videoPath) {
        await fs.move(videoPath, outputPath, { overwrite: true });
        console.log(`  > Scene ${scene.scene_id} 녹화 저장 완료: ${outputPath}`);
      }
    }
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

  /**
   * goto 후 URL을 확인하여 로그인 페이지로 리다이렉트되었는지 감지한다.
   * 세션 만료 시 wait_for 타임아웃(최대 2분)까지 낭비하지 않고 즉시 실패.
   */
  private checkSessionExpired(page: Page, originalUrl: string): void {
    const currentUrl = page.url().toLowerCase();
    const loginPatterns = ['/login', '/signin', '/sign-in', '/auth', '/oauth', '/sso'];
    const isLoginPage = loginPatterns.some(p => currentUrl.includes(p));

    if (isLoginPage) {
      const service = this.guessServiceName(originalUrl);
      throw new Error(
        `세션 만료 감지: ${originalUrl} → ${page.url()}\n` +
        `  로그인 페이지로 리다이렉트되었습니다.\n` +
        `  다음 명령어로 세션을 갱신해 주세요:\n` +
        `  → make save-auth SERVICE=${service}`
      );
    }
  }

  private guessServiceName(url: string): string {
    if (url.includes('claude.ai')) return 'claude';
    if (url.includes('chatgpt.com') || url.includes('openai.com')) return 'chatgpt';
    try { return new URL(url).hostname.split('.')[0]; } catch { return 'unknown'; }
  }

  private async injectCursor(page: Page): Promise<void> {
    await page.evaluate(() => {
      if (document.getElementById('__edu_cur__')) return;
      const cur = document.createElement('div');
      cur.id = '__edu_cur__';
      cur.style.cssText = [
        'position:fixed', 'left:-100px', 'top:-100px',
        'width:14px', 'height:14px', 'border-radius:50%',
        'background:rgba(0,0,0,0.85)', 'border:2px solid rgba(255,255,255,0.9)',
        'box-shadow:0 0 0 1px rgba(0,0,0,0.4)',
        'pointer-events:none', 'z-index:2147483648',
        'transform:translate(-50%,-50%)',
      ].join(';');
      document.body.appendChild(cur);
      document.addEventListener('mousemove', (e: MouseEvent) => {
        cur.style.left = e.clientX + 'px';
        cur.style.top = e.clientY + 'px';
      });
    });
  }

  private async executeActions(
    page: Page,
    actions: PlaywrightAction[],
    sceneId: number,
    phase: 'record',
    options: { hasStorageState?: boolean } = {},
  ): Promise<{ timestamps: RecordingActionTimestamp[]; totalDurationMs: number }> {
    const timestamps: RecordingActionTimestamp[] = [];
    const recordingStart = Date.now();

    for (let i = 0; i < actions.length; i++) {
      const action = actions[i];
      const startMs = Date.now() - recordingStart;

      try {
        switch (action.cmd) {
          case 'goto':
            if (action.url) {
              try {
                await page.goto(action.url, { waitUntil: 'load', timeout: 20000 });
              } catch (_) {
                console.warn(`  ⚠️ goto 타임아웃, 현재 상태로 계속 진행`);
              }
              // storageState 사용 씬: 세션 만료 조기 감지
              if (options.hasStorageState) {
                this.checkSessionExpired(page, action.url);
              }
              await this.injectCursor(page);
            }
            break;
          case 'wait':
            if (action.ms) await page.waitForTimeout(action.ms);
            break;
          case 'wait_for':
            if (action.selector) {
              const state = action.state ?? 'visible';
              const timeout = action.timeout ?? 30000;
              console.log(`  > wait_for: "${action.selector}" (${state}, ${timeout}ms)`);
              await page.locator(action.selector).waitFor({ state, timeout });
            }
            break;
          case 'scroll': {
            const deltaY = action.deltaY ?? 300;
            await page.mouse.wheel(0, deltaY);
            await page.waitForTimeout(300);
            break;
          }
          case 'type':
            if (action.selector && action.key) {
              const typeLoc = page.locator(action.selector);
              await typeLoc.waitFor({ state: 'visible', timeout: 10000 });
              await typeLoc.pressSequentially(action.key, { delay: 100 });
            }
            break;
          case 'click':
            if (action.selector) {
              await page.locator(action.selector).click({ timeout: 10000 });
            }
            break;
          case 'focus':
            if (action.selector) {
              const focusLoc = page.locator(action.selector);
              await focusLoc.waitFor({ state: 'visible', timeout: 10000 });
              await focusLoc.focus();
            }
            break;
          case 'mouse_drag':
            if (action.from && action.to) {
              await page.mouse.move(action.from[0], action.from[1]);
              await page.mouse.down();
              await page.mouse.move(action.to[0], action.to[1], { steps: 10 });
              await page.mouse.up();
            }
            break;
          case 'mouse_move':
            if (action.to) {
              await page.mouse.move(action.to[0], action.to[1], { steps: 30 });
              await page.waitForTimeout(200);
            }
            break;
          case 'press':
            if (action.key) await page.keyboard.press(action.key);
            break;
          case 'disable_css':
            await page.evaluate(() => {
              Array.from(document.styleSheets).forEach(sheet => {
                try {
                  const owner = sheet.ownerNode as Element | null;
                  if (owner?.id?.startsWith('__edu')) return;
                  if (owner?.closest?.('#__edu_devtools__')) return;
                  sheet.disabled = true;
                } catch (_) {}
              });
            });
            await page.waitForTimeout(300);
            break;
          case 'enable_css':
            await page.evaluate(() => {
              Array.from(document.styleSheets).forEach(sheet => {
                try { sheet.disabled = false; } catch (_) {}
              });
            });
            await page.waitForTimeout(300);
            break;
          case 'open_devtools':
          case 'select_devtools_node':
          case 'toggle_devtools_node': {
            const result = await executeEduDevtoolsAction(page, action);
            if (!result?.ok) {
              throw new Error(result?.reason || `DevTools action failed: ${action.cmd}`);
            }
            const settleMs = getEduDevtoolsActionDuration(action.cmd) ?? 0;
            if (settleMs > 0) {
              await page.waitForTimeout(settleMs);
            }
            break;
          }
          case 'highlight':
            if (action.selector) {
              const highlightLoc = page.locator(action.selector);
              await highlightLoc.waitFor({ state: 'attached', timeout: 10000 });
              await highlightLoc.evaluate((el: HTMLElement) => {
                el.style.outline = '5px solid #ff007a';
              });
              await page.waitForTimeout(1500);
            }
            break;
          default:
            console.warn(`  ⚠️ 알려지지 않거나 미구현된 Action '${action.cmd}' (건너뜀)`);
        }
      } catch (actionError: any) {
        console.warn(`  ⚠️ Action '${action.cmd}' 실패 (건너뜀): ${actionError.message}`);
      }

      const endMs = Date.now() - recordingStart;
      timestamps.push({ index: i, cmd: action.cmd, startMs, endMs });
    }

    return { timestamps, totalDurationMs: Date.now() - recordingStart };
  }
}
