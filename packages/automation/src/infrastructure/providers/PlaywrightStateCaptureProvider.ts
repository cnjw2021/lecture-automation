import { chromium, Page } from 'playwright';
import * as path from 'path';
import * as fs from 'fs-extra';
import { config } from '../config';
import { Scene, PlaywrightVisual, PlaywrightAction } from '../../domain/entities/Lecture';
import { SceneManifest, StepData, CursorPosition } from '../../domain/entities/StepManifest';

/**
 * 상태 합성형 Playwright 캡처 프로바이더.
 * 각 액션 step마다 스크린샷 + 이벤트 매니페스트를 저장한다.
 * 결과물은 Remotion PlaywrightSynthScene에서 합성 렌더링에 사용된다.
 */
export class PlaywrightStateCaptureProvider {
  async capture(scene: Scene, outputDir: string): Promise<SceneManifest | null> {
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
          const stepData = await this.executeAndCapture(
            page, action, stepIndex, outputDir, cursorPos, width, height
          );

          if (stepData) {
            steps.push(stepData);
            // 커서 위치 업데이트
            if (stepData.cursorTo) {
              cursorPos = stepData.cursorTo;
            }
            stepIndex++;
          }
        } catch (actionError: any) {
          console.warn(`  ⚠️ Action '${action.cmd}' 캡처 실패: ${actionError.message}`);
        }
      }

      // 마지막 상태 스크린샷
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
        lectureId: '',  // RecordVisualUseCase에서 설정
        totalSteps: steps.length,
        totalDurationMs,
        viewport: { width, height },
        steps,
      };

      // 매니페스트 저장
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

  private async executeAndCapture(
    page: Page,
    action: PlaywrightAction,
    stepIndex: number,
    outputDir: string,
    cursorPos: CursorPosition,
    viewportWidth: number,
    viewportHeight: number,
  ): Promise<StepData | null> {
    const screenshotName = `step-${stepIndex}.png`;
    const screenshotPath = path.join(outputDir, screenshotName);

    switch (action.cmd) {
      case 'goto': {
        if (!action.url) return null;
        try {
          await page.goto(action.url, { waitUntil: 'load', timeout: 20000 });
        } catch (_) {
          console.warn(`  ⚠️ goto 타임아웃, 현재 상태로 계속 진행`);
        }
        await page.screenshot({ path: screenshotPath });
        return {
          index: stepIndex,
          cmd: 'goto',
          screenshot: screenshotName,
          cursorFrom: cursorPos,
          cursorTo: cursorPos,
          scrollY: 0,
          durationMs: 1000,
          note: action.note,
        };
      }

      case 'wait': {
        await page.screenshot({ path: screenshotPath });
        return {
          index: stepIndex,
          cmd: 'wait',
          screenshot: screenshotName,
          cursorFrom: cursorPos,
          cursorTo: cursorPos,
          durationMs: action.ms || 1000,
          note: action.note,
        };
      }

      case 'mouse_move': {
        if (!action.to) return null;
        // 먼저 현재 상태 스크린샷
        await page.screenshot({ path: screenshotPath });
        const toPos: CursorPosition = { x: action.to[0], y: action.to[1] };
        // 실제로 마우스 이동 (hover 효과 반영을 위해)
        await page.mouse.move(action.to[0], action.to[1], { steps: 30 });
        return {
          index: stepIndex,
          cmd: 'mouse_move',
          screenshot: screenshotName,
          cursorFrom: cursorPos,
          cursorTo: toPos,
          durationMs: 700,
          note: action.note,
        };
      }

      case 'click': {
        if (!action.selector) return null;
        const clickLoc = page.locator(action.selector);
        await clickLoc.waitFor({ state: 'visible', timeout: 10000 });
        const box = await clickLoc.boundingBox();
        // 스크린샷은 클릭 전에 찍음
        await page.screenshot({ path: screenshotPath });
        const clickTarget: CursorPosition = box
          ? { x: box.x + box.width / 2, y: box.y + box.height / 2 }
          : cursorPos;
        // 실제 클릭 실행
        await clickLoc.click({ timeout: 10000 });
        return {
          index: stepIndex,
          cmd: 'click',
          screenshot: screenshotName,
          cursorFrom: cursorPos,
          cursorTo: clickTarget,
          targetBox: box ? { x: box.x, y: box.y, width: box.width, height: box.height } : undefined,
          durationMs: 500,
          isClick: true,
          note: action.note,
        };
      }

      case 'type': {
        if (!action.selector || !action.key) return null;
        const typeLoc = page.locator(action.selector);
        await typeLoc.waitFor({ state: 'visible', timeout: 10000 });
        const typeBox = await typeLoc.boundingBox();
        await page.screenshot({ path: screenshotPath });
        // 실제 타이핑 실행
        await typeLoc.pressSequentially(action.key, { delay: 100 });
        const charDuration = action.key.length * 120; // 문자당 120ms (타이핑 + 약간의 여유)
        return {
          index: stepIndex,
          cmd: 'type',
          screenshot: screenshotName,
          cursorFrom: cursorPos,
          cursorTo: typeBox
            ? { x: typeBox.x + typeBox.width / 2, y: typeBox.y + typeBox.height / 2 }
            : cursorPos,
          targetBox: typeBox ? { x: typeBox.x, y: typeBox.y, width: typeBox.width, height: typeBox.height } : undefined,
          typedText: action.key,
          durationMs: Math.max(charDuration, 500),
          note: action.note,
        };
      }

      case 'focus': {
        if (!action.selector) return null;
        const focusLoc = page.locator(action.selector);
        await focusLoc.waitFor({ state: 'visible', timeout: 10000 });
        const focusBox = await focusLoc.boundingBox();
        await page.screenshot({ path: screenshotPath });
        await focusLoc.focus();
        return {
          index: stepIndex,
          cmd: 'focus',
          screenshot: screenshotName,
          cursorFrom: cursorPos,
          cursorTo: focusBox
            ? { x: focusBox.x + focusBox.width / 2, y: focusBox.y + focusBox.height / 2 }
            : cursorPos,
          targetBox: focusBox ? { x: focusBox.x, y: focusBox.y, width: focusBox.width, height: focusBox.height } : undefined,
          durationMs: 300,
          note: action.note,
        };
      }

      case 'mouse_drag': {
        if (!action.from || !action.to) return null;
        await page.screenshot({ path: screenshotPath });
        await page.mouse.move(action.from[0], action.from[1]);
        await page.mouse.down();
        await page.mouse.move(action.to[0], action.to[1], { steps: 10 });
        await page.mouse.up();
        return {
          index: stepIndex,
          cmd: 'mouse_drag',
          screenshot: screenshotName,
          cursorFrom: { x: action.from[0], y: action.from[1] },
          cursorTo: { x: action.to[0], y: action.to[1] },
          durationMs: 800,
          note: action.note,
        };
      }

      case 'press': {
        if (!action.key) return null;
        await page.screenshot({ path: screenshotPath });
        await page.keyboard.press(action.key);
        return {
          index: stepIndex,
          cmd: 'press',
          screenshot: screenshotName,
          cursorFrom: cursorPos,
          cursorTo: cursorPos,
          durationMs: 300,
          note: action.note,
        };
      }

      case 'highlight': {
        if (!action.selector) return null;
        const hlLoc = page.locator(action.selector);
        await hlLoc.waitFor({ state: 'attached', timeout: 10000 });
        const hlBox = await hlLoc.boundingBox();
        // ハイライト適用してからスクリーンショット
        await hlLoc.evaluate((el: HTMLElement) => {
          el.style.outline = '5px solid #ff007a';
        });
        await page.screenshot({ path: screenshotPath });
        return {
          index: stepIndex,
          cmd: 'highlight',
          screenshot: screenshotName,
          cursorFrom: cursorPos,
          cursorTo: cursorPos,
          targetBox: hlBox ? { x: hlBox.x, y: hlBox.y, width: hlBox.width, height: hlBox.height } : undefined,
          durationMs: 1500,
          isHighlight: true,
          note: action.note,
        };
      }

      case 'open_devtools': {
        // DevTools는 evaluate로 주입 후 스크린샷
        await page.evaluate(() => {
          if (document.getElementById('__edu_devtools__')) return;
          // サイト表示領域を左側62%に制限するラッパー
          if (!document.getElementById('__edu_site_wrapper__')) {
            const siteWidthPx = Math.round(window.innerWidth * 0.62);
            const wrapper = document.createElement('div');
            wrapper.id = '__edu_site_wrapper__';
            wrapper.style.cssText = [
              'position:fixed', 'left:0', 'top:0',
              'width:' + siteWidthPx + 'px', 'height:100vh',
              'overflow-y:auto', 'overflow-x:hidden', 'z-index:1',
            ].join(';');
            while (document.body.firstChild) {
              wrapper.appendChild(document.body.firstChild);
            }
            document.body.appendChild(wrapper);
            document.body.style.overflow = 'hidden';
            document.body.style.margin = '0';
          }
          const overlay = document.createElement('div');
          overlay.id = '__edu_devtools__';
          overlay.style.cssText = [
            'position:fixed', 'right:0', 'top:0', 'bottom:0', 'width:38%',
            'z-index:2147483647', 'background:#1e1e1e',
            'box-shadow:-4px 0 20px rgba(0,0,0,0.7)',
          ].join(';');
          overlay.innerHTML = '<div style="color:#9aa0a6;padding:12px;font-family:monospace;font-size:12px">Elements panel</div>';
          document.body.appendChild(overlay);
        });
        await page.waitForTimeout(300);
        await page.screenshot({ path: screenshotPath });
        return {
          index: stepIndex,
          cmd: 'open_devtools',
          screenshot: screenshotName,
          cursorFrom: cursorPos,
          cursorTo: cursorPos,
          durationMs: 500,
          note: action.note,
        };
      }

      case 'disable_css': {
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
        await page.waitForTimeout(200);
        await page.screenshot({ path: screenshotPath });
        return {
          index: stepIndex,
          cmd: 'disable_css',
          screenshot: screenshotName,
          cursorFrom: cursorPos,
          cursorTo: cursorPos,
          durationMs: 500,
          note: action.note,
        };
      }

      case 'enable_css': {
        await page.evaluate(() => {
          Array.from(document.styleSheets).forEach(sheet => {
            try { sheet.disabled = false; } catch (_) {}
          });
        });
        await page.waitForTimeout(200);
        await page.screenshot({ path: screenshotPath });
        return {
          index: stepIndex,
          cmd: 'enable_css',
          screenshot: screenshotName,
          cursorFrom: cursorPos,
          cursorTo: cursorPos,
          durationMs: 500,
          note: action.note,
        };
      }

      default:
        console.warn(`  ⚠️ 미지원 Action '${action.cmd}' (건너뜀)`);
        return null;
    }
  }
}
