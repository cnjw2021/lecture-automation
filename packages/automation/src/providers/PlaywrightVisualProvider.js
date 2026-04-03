const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs-extra');
const VisualProvider = require('./VisualProvider');
const videoConfig = require('../../../../config/video.json');

class PlaywrightVisualProvider extends VisualProvider {
  constructor() {
    super();
  }

  async record(scene, outputPath) {
    const { width, height } = videoConfig.resolution;
    const browser = await chromium.launch({ headless: true });
    // 녹화를 위해 recordVideo 옵션 설정 (config/video.json의 resolution 사용)
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
      for (const action of scene.visual.action) {
        try {
          switch (action.cmd) {
            case 'goto':
              await page.goto(action.url, { waitUntil: 'networkidle', timeout: 15000 });
              break;
            case 'wait':
              await page.waitForTimeout(action.ms);
              break;
            case 'type':
              await page.type(action.selector, action.text, { delay: 100 });
              break;
            case 'click':
              await page.click(action.selector, { timeout: 10000 });
              break;
            case 'highlight':
              await page.evaluate((sel) => {
                const el = document.querySelector(sel);
                if (el) el.style.outline = '5px solid #ff007a';
              }, action.selector);
              await page.waitForTimeout(1500);
              break;
          }
        } catch (actionError) {
          console.warn(`  ⚠️ Action '${action.cmd}' 실패 (건너뜀): ${actionError.message}`);
        }
      }
      await page.waitForTimeout(2000); 
    } catch (error) {
      console.error(`  > Scene ${scene.scene_id} 녹화 중 에러:`, error.message);
    } finally {
      const videoPath = await page.video().path();
      await context.close();
      await browser.close();

      if (videoPath) {
        await fs.move(videoPath, outputPath, { overwrite: true });
        console.log(`  > Scene ${scene.scene_id} 녹화 저장 완료: ${outputPath}`);
      }
    }
  }
}

module.exports = PlaywrightVisualProvider;
