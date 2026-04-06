import { chromium } from 'playwright';
import * as path from 'path';
import * as fs from 'fs-extra';
import { config } from '../config';
import { IScreenshotProvider } from '../../domain/interfaces/IScreenshotProvider';

export class PlaywrightScreenshotProvider implements IScreenshotProvider {
  async capture(url: string, outputPath: string, waitMs: number = 2000): Promise<void> {
    const videoConfig = config.getVideoConfig();
    const { width, height } = videoConfig.resolution;

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

    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 20000 });
      if (waitMs > 0) await page.waitForTimeout(waitMs);

      await fs.ensureDir(path.dirname(outputPath));
      await page.screenshot({ path: outputPath, fullPage: false });
      console.log(`  > 스크린샷 저장 완료: ${outputPath}`);
    } finally {
      await context.close();
      await browser.close();
    }
  }
}
