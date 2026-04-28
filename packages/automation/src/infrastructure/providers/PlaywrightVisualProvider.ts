import { chromium, Page, LaunchOptions } from 'playwright';
import * as path from 'path';
import * as fs from 'fs-extra';
import { config } from '../config';
import { IVisualProvider } from '../../domain/interfaces/IVisualProvider';
import { Scene, PlaywrightVisual, PlaywrightAction } from '../../domain/entities/Lecture';
import { executeEduDevtoolsAction, getEduDevtoolsActionDuration } from './playwrightEduDevtools';
import { typeWithTimeout } from './playwrightBrowserUtils';

/**
 * 액션 실패 시 즉시 파이프라인을 중단해야 하는 critical 액션 목록.
 * 이 액션들이 실패하면 webm 이 garbage 상태가 되어 후속 렌더·concat 이 무의미해진다.
 *
 * 그 외 액션(`wait_for`, `mouse_move`, `highlight`, `mouse_drag`, `scroll`,
 * `disable_css`, `enable_css`, `wait`, `render_code_block`)은 실패해도
 * 시각 효과 누락 정도라 warn + continue.
 */
const CRITICAL_ACTION_CMDS = new Set([
  'goto',
  'click',
  'type',
  'press',
  'focus',
  'open_devtools',
  'select_devtools_node',
  'toggle_devtools_node',
]);

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
  /** Claude 등 대화형 AI 씬에서 프롬프트 전송 후 생성된 대화 URL. 후속 씬이 urlFromScene으로 참조. */
  conversationUrl?: string;
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

    // storageState 사용 시 실제 Chrome + headed 모드 (Cloudflare Turnstile 통과 필수)
    const useRealChrome = !!storageStatePath;
    const launchOptions = {
      headless: !useRealChrome,
      ...(useRealChrome ? {
        channel: 'chrome' as const,
        args: ['--disable-blink-features=AutomationControlled'],
      } : {}),
    };

    // storageState 씬: 녹화 전 프리플라이트로 사이드바 닫힌 상태의 storageState 생성
    let effectiveStorageState: string | undefined = storageStatePath;
    if (storageStatePath) {
      effectiveStorageState = await this.preflightCloseSidebar(
        launchOptions, storageStatePath, width, height,
      );
    }

    const browser = await chromium.launch(launchOptions);
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
      ...(effectiveStorageState ? { storageState: effectiveStorageState } : {}),
    });

    await context.tracing.start({ screenshots: true, snapshots: true });

    const page = await context.newPage();
    let hasError = false;
    let caughtError: Error | undefined;

    try {
      console.log(`- Scene ${scene.scene_id} 녹화 시작...`);
      const { timestamps, totalDurationMs } = await this.executeActions(
        page, visualConfig.action, scene.scene_id, 'record',
        { hasStorageState: !!storageStatePath, outputPath },
      );
      await page.waitForTimeout(2000);

      // 매니페스트 저장 (모든 playwright 씬에 생성 — 역방향 싱크·검증·디버깅용)
      const finalUrl = page.url();
      const conversationUrl = this.extractConversationUrl(finalUrl);
      const manifest: RecordingManifest = {
        sceneId: scene.scene_id,
        totalDurationMs: totalDurationMs + 2000,
        actionTimestamps: timestamps,
        ...(conversationUrl ? { conversationUrl } : {}),
      };
      const manifestPath = outputPath.replace(/\.\w+$/, '.manifest.json');
      await fs.writeJson(manifestPath, manifest, { spaces: 2 });
      console.log(`  > 녹화 매니페스트 저장: ${manifestPath}`);
      if (conversationUrl) {
        console.log(`  > conversationUrl 기록: ${conversationUrl}`);
      }
    } catch (error: any) {
      hasError = true;
      caughtError = error;
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
        if (hasError) {
          // 부분 녹화된 garbage webm 이 캐시 경로로 저장되면 다음 실행에서 캐시 hit 으로
          // 잘못 재사용된다. 임시 webm 자체는 context.close 후 임시 디렉토리에 남아 있을 수
          // 있으므로 명시적으로 삭제한다.
          await fs.remove(videoPath).catch(() => {});
          console.log(`  > 에러 발생 → 부분 녹화 webm 폐기 (캐시 미생성)`);
        } else {
          await fs.move(videoPath, outputPath, { overwrite: true });
          console.log(`  > Scene ${scene.scene_id} 녹화 저장 완료: ${outputPath}`);
        }
      }
    }

    // critical 액션 실패는 호출자(RecordVisualUseCase)로 전파해 파이프라인을 중단시킨다.
    if (caughtError) {
      throw caughtError;
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
   * 녹화 전 프리플라이트: 사이드바를 닫은 상태의 storageState를 생성한다.
   * 임시 브라우저로 대상 사이트를 열어 localStorage의 사이드바 키를 찾아 false로 설정,
   * 갱신된 storageState를 임시 파일로 저장하여 반환한다.
   */
  private async preflightCloseSidebar(
    launchOptions: LaunchOptions,
    storageStatePath: string,
    width: number,
    height: number,
  ): Promise<string> {
    console.log('  > 프리플라이트: 사이드바 닫힌 상태 설정 중...');
    const browser = await chromium.launch(launchOptions);
    try {
      const ctx = await browser.newContext({
        viewport: { width, height },
        storageState: storageStatePath,
      });
      const page = await ctx.newPage();
      try {
        await page.goto('https://claude.ai/new', { waitUntil: 'domcontentloaded', timeout: 15000 });
      } catch (_) {}

      // SPA 렌더링 대기
      await page.waitForTimeout(3000);

      // 사이드바 토글 버튼을 클릭하여 SPA 자체가 상태를 저장하게 함
      const toggled = await page.evaluate(() => {
        // 방법 1: data-testid로 토글 버튼 탐색
        const toggleBtn = document.querySelector('[data-testid="sidebar-toggle"]')
          || document.querySelector('[data-testid="close-sidebar"]')
          || document.querySelector('button[aria-label*="sidebar" i]')
          || document.querySelector('button[aria-label*="サイドバー"]');
        if (toggleBtn) {
          (toggleBtn as HTMLElement).click();
          return 'button-click';
        }
        // 방법 2: localStorage 키를 직접 찾아 설정
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.includes('chatControlsSidebarIsOpen')) {
            localStorage.setItem(key, 'false');
            return 'key-set: ' + key;
          }
        }
        // 방법 3: LSS 접두사 UUID를 다른 키에서 추출하여 키 생성
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith('LSS-')) {
            const uuid = key.split(':')[0]; // "LSS-xxxx-..."
            const sidebarKey = uuid + ':chatControlsSidebarIsOpen';
            localStorage.setItem(sidebarKey, 'false');
            return 'key-created: ' + sidebarKey;
          }
        }
        return 'no-action';
      });
      console.log(`  > 프리플라이트 사이드바 처리: ${toggled}`);

      await page.waitForTimeout(1000);

      // 갱신된 storageState를 임시 파일로 저장
      const updatedPath = storageStatePath.replace(/\.json$/, '.sidebar-closed.json');
      await ctx.storageState({ path: updatedPath });
      await ctx.close();
      console.log('  > 프리플라이트 완료: 사이드바 닫힌 상태 저장됨');
      return updatedPath;
    } finally {
      await browser.close();
    }
  }

  /**
   * Claude 응답 완료까지 폴링 대기.
   * /chat/{uuid} URL을 goto 한 직후 사용 — 대화 본문이 비어 있을 수 있으므로
   * 스트리밍 인디케이터 / 빈 상태 메시지 / 메시지 DOM 등 여러 신호로 완료 판정.
   * 10초 간격 폴링, 기본 타임아웃 180초.
   */
  private async waitForClaudeReady(page: Page, timeoutMs = 180000): Promise<void> {
    const startedAt = Date.now();
    const deadline = startedAt + timeoutMs;
    const hints = [
      'Claude 응답 대기 중...',
      '시간이 조금 걸리고 있습니다...',
      '조금 더 기다려 봅시다...',
      '곧 응답이 돌아올 것 같습니다...',
      '응답 생성이 계속되고 있습니다, 잠시만요...',
    ];
    let attempt = 0;

    while (Date.now() < deadline) {
      const state = await page.evaluate(() => {
        const streamingTrue = document.querySelector('[data-is-streaming="true"]');
        if (streamingTrue) return 'streaming';

        const emptyGreeting = Array.from(document.querySelectorAll('h1, h2, p, div'))
          .find(el => {
            const t = (el.textContent || '').trim();
            return t === '本日はどのようなお手伝いができますか？'
              || t === 'How can I help you today?'
              || t.startsWith('本日はどのような');
          });
        if (emptyGreeting) return 'empty';

        const streamingFalse = document.querySelector('[data-is-streaming="false"]');
        if (streamingFalse) return 'ready';

        const hasArtifact = !!document.querySelector(
          '[aria-label*="artifact" i], [class*="artifact-block" i], button[aria-label*="アーティファクト"]'
        );
        const hasProse = document.querySelectorAll('.prose, [class*="message-"]').length > 0;
        if (hasArtifact || hasProse) return 'ready';

        return 'unknown';
      }).catch(() => 'unknown');

      if (state === 'ready') {
        const elapsed = Math.round((Date.now() - startedAt) / 1000);
        console.log(`  > Claude 응답 준비 완료 (경과: ${elapsed}s)`);
        return;
      }

      const hint = hints[Math.min(attempt, hints.length - 1)];
      const elapsed = Math.round((Date.now() - startedAt) / 1000);
      console.log(`  > ${hint} (상태: ${state}, 경과: ${elapsed}s)`);
      attempt++;
      await page.waitForTimeout(10000);
    }
    console.warn(`  ⚠️ Claude 응답 대기 타임아웃 (${timeoutMs}ms) — 계속 진행`);
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

  /**
   * 현재 페이지 URL이 대화형 AI 씬의 고유 대화 URL이면 그대로 반환한다.
   * Claude: claude.ai/chat/{uuid} | ChatGPT: chatgpt.com/c/{uuid}
   * 대화 URL이 아닌 경우(예: claude.ai/new, 홈, 로그인 등)에는 undefined.
   */
  private extractConversationUrl(pageUrl: string): string | undefined {
    const claudeMatch = /^https:\/\/claude\.ai\/chat\/[0-9a-f-]+/i.exec(pageUrl);
    if (claudeMatch) return claudeMatch[0];
    const chatgptMatch = /^https:\/\/chatgpt\.com\/c\/[0-9a-f-]+/i.exec(pageUrl);
    if (chatgptMatch) return chatgptMatch[0];
    return undefined;
  }

  /**
   * urlFromScene으로 지정된 씬의 manifest.json에서 conversationUrl을 읽어 반환한다.
   * 동일 lectureId 디렉토리 내의 scene-{id}.manifest.json을 조회한다.
   */
  private resolveUrlFromScene(targetSceneId: number, currentOutputPath: string): string | undefined {
    const dir = path.dirname(currentOutputPath);
    const manifestPath = path.join(dir, `scene-${targetSceneId}.manifest.json`);
    if (!fs.existsSync(manifestPath)) {
      console.warn(`  ⚠️ urlFromScene=${targetSceneId}: 매니페스트 없음 (${manifestPath})`);
      return undefined;
    }
    try {
      const manifest = fs.readJsonSync(manifestPath) as RecordingManifest;
      if (!manifest.conversationUrl) {
        console.warn(`  ⚠️ urlFromScene=${targetSceneId}: manifest에 conversationUrl 없음`);
        return undefined;
      }
      return manifest.conversationUrl;
    } catch (err: any) {
      console.warn(`  ⚠️ urlFromScene=${targetSceneId}: manifest 읽기 실패 (${err.message})`);
      return undefined;
    }
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
    options: { hasStorageState?: boolean; outputPath?: string } = {},
  ): Promise<{ timestamps: RecordingActionTimestamp[]; totalDurationMs: number }> {
    const timestamps: RecordingActionTimestamp[] = [];
    const recordingStart = Date.now();

    for (let i = 0; i < actions.length; i++) {
      const action = actions[i];
      const startMs = Date.now() - recordingStart;

      try {
        switch (action.cmd) {
          case 'goto': {
            let targetUrl: string | undefined = action.url;
            if (action.urlFromScene !== undefined && options.outputPath) {
              const resolved = this.resolveUrlFromScene(action.urlFromScene, options.outputPath);
              if (resolved) {
                targetUrl = resolved;
                console.log(`  > goto urlFromScene=${action.urlFromScene}: ${resolved}`);
              } else if (!targetUrl) {
                console.warn(`  ⚠️ goto urlFromScene=${action.urlFromScene} 실패 + url fallback 없음 (건너뜀)`);
                break;
              }
            }
            if (targetUrl) {
              try {
                await page.goto(targetUrl, { waitUntil: 'load', timeout: 20000 });
              } catch (_) {
                console.warn(`  ⚠️ goto 타임아웃, 현재 상태로 계속 진행`);
              }
              // storageState 사용 씬: 세션 만료 조기 감지
              if (options.hasStorageState) {
                this.checkSessionExpired(page, targetUrl);
              }
              await this.injectCursor(page);
            }
            break;
          }
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
          case 'wait_for_claude_ready':
            await this.waitForClaudeReady(page, action.timeout ?? 180000);
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
              await typeWithTimeout(typeLoc, action.key, {
                delay: 100,
                selector: action.selector,
              });
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
          case 'render_code_block': {
            // Artifact iframe을 폴링하여 HTML 추출 (최대 30초 대기)
            // 폴백: <pre> 코드 블록에서 가장 긴 텍스트 추출
            let extractedHtml: string | null = null;

            const maxRetries = 15; // 2초 간격 × 15회 = 최대 30초
            for (let attempt = 0; attempt < maxRetries; attempt++) {
              const artifactFrame = page.frames().find(f => {
                const url = f.url();
                return url.includes('claudemcpcontent.com') || url.includes('isolated-segment');
              });
              if (artifactFrame) {
                extractedHtml = await artifactFrame.evaluate(() => {
                  const inner = document.querySelector('iframe');
                  if (inner?.contentDocument?.documentElement) {
                    return inner.contentDocument.documentElement.outerHTML;
                  }
                  return document.documentElement.outerHTML;
                }).catch(() => null);
              }
              if (extractedHtml && extractedHtml.length > 100) {
                console.log(`  > render_code_block: Artifact iframe 발견 (${attempt + 1}회 시도)`);
                break;
              }
              extractedHtml = null;
              if (attempt < maxRetries - 1) {
                console.log(`  > render_code_block: Artifact iframe 대기 중... (${attempt + 1}/${maxRetries})`);
                await page.waitForTimeout(2000);
              }
            }

            // Artifact 없으면 <pre> 코드 블록 폴백
            if (!extractedHtml) {
              console.log('  > render_code_block: Artifact 미발견, <pre> 폴백 시도');
              extractedHtml = await page.evaluate(() => {
                const pres = document.querySelectorAll('pre');
                let longest = '';
                pres.forEach(pre => {
                  const text = pre.textContent || '';
                  if (text.length > longest.length) longest = text;
                });
                return longest || null;
              });
            }

            if (extractedHtml) {
              console.log(`  > render_code_block: ${extractedHtml.length}자 HTML 추출 → 렌더`);
              await page.goto('about:blank');
              await page.setContent(extractedHtml, { waitUntil: 'load' });
              await page.waitForTimeout(1000);
            } else {
              console.warn('  ⚠️ render_code_block: 코드 블록/Artifact를 찾을 수 없음');
            }
            break;
          }
          default:
            console.warn(`  ⚠️ 알려지지 않거나 미구현된 Action '${action.cmd}' (건너뜀)`);
        }
      } catch (actionError: any) {
        if (CRITICAL_ACTION_CMDS.has(action.cmd)) {
          // critical 액션 실패 = webm 이 garbage 상태 → fail-fast.
          // 실패 위치를 명확히 알려 사용자가 JSON 또는 환경을 고친 뒤 재시작하도록 한다.
          throw new Error(
            `Critical action '${action.cmd}' (index=${i}) 실패 — 녹화 중단: ${actionError.message}`,
          );
        }
        console.warn(`  ⚠️ Action '${action.cmd}' 실패 (건너뜀): ${actionError.message}`);
      }

      const endMs = Date.now() - recordingStart;
      timestamps.push({ index: i, cmd: action.cmd, startMs, endMs });
    }

    return { timestamps, totalDurationMs: Date.now() - recordingStart };
  }
}
