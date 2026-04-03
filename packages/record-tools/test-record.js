const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

async function runRecording(lessonId) {
  // 1. 영상 저장 경로 설정 (Remotion의 public 폴더로 바로 보냄)
  const videoDir = path.join(__dirname, '../remotion-project/public/captures');
  if (!fs.existsSync(videoDir)) fs.mkdirSync(videoDir, { recursive: true });

  const browser = await chromium.launch({
    headless: false, // 조작 과정을 눈으로 확인하려면 false
    args: ['--font-render-hinting=none', '--force-device-scale-factor=2'] 
  });

  const context = await browser.newContext({
    // Full HD 강의를 위한 2배수 레티나 설정 (2560x1440 녹화용)
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 2,
    recordVideo: {
      dir: videoDir,
      size: { width: 2560, height: 1440 }, // 1280*2, 720*2
    }
  });

  const page = await context.newPage();

  try {
    console.log(`[${lessonId}] 녹화 시작...`);

    // 예시: AI 툴(v0.dev) 조작 시뮬레이션
    await page.goto('https://v0.dev');
    
    // 마우스 움직임과 타이핑을 실제 사람처럼 보이게 딜레이 추가
    await page.waitForTimeout(2000);
    
    // 프롬프트 입력창 찾기 및 입력
    const promptInput = page.getByPlaceholder('What can I help you ship today?');
    await promptInput.click();
    await page.keyboard.type('Create a modern landing page for a coffee shop using Tailwind CSS.', { delay: 80 });
    await page.keyboard.press('Enter');

    // 결과가 생성되는 동안 충분히 대기 (강의 스크립트 길이에 맞춰 조절 가능)
    await page.waitForTimeout(10000); 

    console.log('녹화 완료 중...');
  } catch (error) {
    console.error('녹화 중 에러 발생:', error);
  } finally {
    await context.close(); // 여기서 영상 파일이 최종 저장됨
    await browser.close();

    // 저장된 파일명을 lessonId에 맞게 변경하는 로직 (선택 사항)
    const files = fs.readdirSync(videoDir);
    const latestFile = files.filter(f => f.endsWith('.webm')).pop();
    if (latestFile) {
      fs.renameSync(
        path.join(videoDir, latestFile),
        path.join(videoDir, `${lessonId}.webm`)
      );
      console.log(`성공: ${lessonId}.webm 파일이 생성되었습니다.`);
    }
  }
}

// 실행
runRecording('lesson-01');
