import { chromium } from 'playwright';
import * as path from 'path';
import * as fs from 'fs-extra';
import { config } from '../config';
import { IVisualProvider } from '../../domain/interfaces/IVisualProvider';
import { Scene, PlaywrightVisual } from '../../domain/entities/Lecture';

export class PlaywrightVisualProvider implements IVisualProvider {
  async record(scene: Scene, outputPath: string): Promise<void> {
    if (scene.visual.type !== 'playwright') {
      return;
    }

    const visualConfig = scene.visual as PlaywrightVisual;
    const videoConfig = config.getVideoConfig();
    const { width, height } = videoConfig.resolution;
    
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      viewport: { width, height },
      deviceScaleFactor: 1,
      recordVideo: {
        dir: path.dirname(outputPath),
        size: { width, height },
      }
    });

    const page = await context.newPage();

    try {
      console.log(`- Scene ${scene.scene_id} 녹화 시작...`);
      for (const action of visualConfig.action) {
        try {
          switch (action.cmd) {
            case 'goto':
              if (action.url) await page.goto(action.url, { waitUntil: 'networkidle', timeout: 15000 });
              break;
            case 'wait':
              if (action.ms) await page.waitForTimeout(action.ms);
              break;
            case 'type':
              if (action.selector && action.key) await page.type(action.selector, action.key, { delay: 100 });
              break;
            case 'click':
              if (action.selector) await page.click(action.selector, { timeout: 10000 });
              break;
            case 'focus':
              if (action.selector) await page.focus(action.selector, { timeout: 10000 });
              break;
            case 'mouse_drag':
              if (action.from && action.to) {
                await page.mouse.move(action.from[0], action.from[1]);
                await page.mouse.down();
                await page.mouse.move(action.to[0], action.to[1], { steps: 10 });
                await page.mouse.up();
              }
              break;
            case 'highlight':
              if (action.selector) {
                await page.evaluate((sel: string) => {
                  const el = document.querySelector(sel) as HTMLElement;
                  if (el) el.style.outline = '5px solid #ff007a';
                }, action.selector);
                await page.waitForTimeout(1500);
              }
              break;
            default:
              console.warn(`  ⚠️ 알려지지 않거나 미구현된 Action '${action.cmd}' (건너뜀)`);
          }
        } catch (actionError: any) {
          console.warn(`  ⚠️ Action '${action.cmd}' 실패 (건너뜀): ${actionError.message}`);
        }
      }
      await page.waitForTimeout(2000); 
    } catch (error: any) {
      console.error(`  > Scene ${scene.scene_id} 녹화 중 에러:`, error.message);
    } finally {
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
}
