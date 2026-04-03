const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs-extra');

async function recordVisuals(jsonFileName) {
  const filePath = path.join(__dirname, '../data', jsonFileName);
  const rawData = await fs.readFile(filePath, 'utf8');
  const lectureData = JSON.parse(rawData);

  const videoOutputDir = path.join(__dirname, '../remotion-project/public/captures', lectureData.lecture_id);
  await fs.ensureDir(videoOutputDir);

  console.log(`[${lectureData.lecture_id}] 시각 자료 녹화 시작 (Playwright)...`);

  const browser = await chromium.launch({
    headless: false, // 실제 동작을 확인하려면 false, CI 환경에서는 true
    args: ['--font-render-hinting=none', '--force-device-scale-factor=2'] 
  });

  for (const scene of lectureData.sequence) {
    if (scene.visual.type !== 'playwright') {
      console.log(`- Scene ${scene.scene_id}: Remotion 컴포넌트 타입이므로 건너뜁니다.`);
      continue;
    }

    const fileName = `scene-${scene.scene_id}.webm`;
    const outputPath = path.join(videoOutputDir, fileName);

    if (await fs.pathExists(outputPath)) {
       console.log(`- Scene ${scene.scene_id} 이미 존재함. 건너뜁니다.`);
       continue;
    }

    console.log(`- Scene ${scene.scene_id} 녹화 중...`);

    // 각 씬마다 새로운 컨텍스트 생성 (녹화 파일 분리 목적)
    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      deviceScaleFactor: 2,
      recordVideo: {
        dir: videoOutputDir,
        size: { width: 2560, height: 1440 },
      }
    });

    const page = await context.newPage();

    try {
      // JSON에 정의된 액션들을 순차적으로 실행
      for (const action of scene.visual.action) {
        console.log(`  > Action: ${action.cmd} (${action.selector || action.url || ''})`);
        
        switch (action.cmd) {
          case 'goto':
            await page.goto(action.url, { waitUntil: 'networkidle' });
            break;
          case 'wait':
            await page.waitForTimeout(action.ms);
            break;
          case 'type':
            await page.type(action.selector, action.text, { delay: 100 });
            break;
          case 'press':
            await page.keyboard.press(action.key);
            break;
          case 'click':
            await page.click(action.selector);
            break;
          case 'scroll':
            await page.locator(action.selector).scrollIntoViewIfNeeded();
            break;
          case 'hover':
            await page.hover(action.selector);
            break;
          case 'evaluate':
            await page.evaluate(action.script);
            break;
          case 'highlight':
            await page.evaluate((sel) => {
              const el = document.querySelector(sel);
              if (el) {
                el.style.outline = '5px solid #ff007a';
                el.style.outlineOffset = '5px';
                el.style.backgroundColor = 'rgba(255, 0, 122, 0.1)';
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }
            }, action.selector);
            await page.waitForTimeout(2000);
            break;
        }
      }

      // 나레이션 길이를 고려하여 추가 대기 (나중에 실제 오디오 길이와 동기화 필요)
      await page.waitForTimeout(3000); 

    } catch (error) {
      console.error(`- Scene ${scene.scene_id} 에러:`, error.message);
    } finally {
      const videoPath = await page.video().path();
      await context.close();
      
      // 녹화된 임시 파일을 지정된 파일명으로 변경
      if (videoPath) {
        await fs.move(videoPath, outputPath, { overwrite: true });
      }
    }
  }

  await browser.close();
  console.log(`✅ 모든 시각 자료 녹화 완료: ${videoOutputDir}`);
}

if (require.main === module) {
  const jsonFile = process.argv[2] || 'p1-01-01.json';
  recordVisuals(jsonFile).catch(console.error);
}
