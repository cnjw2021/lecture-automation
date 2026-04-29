import {
  PlaywrightActionHandler,
  CaptureContext,
  RecordContext,
  OffscreenContext,
} from '../../../domain/playwright/PlaywrightActionHandler';
import { estimatePlaywrightActionDurationMs } from '../../../domain/playwright/ActionTiming';

const ARTIFACT_POLL_INTERVAL_MS = 2000;
const ARTIFACT_MAX_RETRIES = 15;
const SETTLE_AFTER_RENDER_MS = 1000;

export const renderCodeBlockHandler: PlaywrightActionHandler = {
  cmd: 'render_code_block',
  estimateDurationMs: estimatePlaywrightActionDurationMs,

  async executeForCapture(_page, _action, _ctx: CaptureContext) {
    // state-capture 모드는 manifest step 을 만들지 않는다.
    // 실제 코드 블록 렌더는 녹화 모드에서만 의미가 있다.
    return null;
  },

  async executeForRecording(page, _action, _ctx: RecordContext) {
    // Artifact iframe 을 폴링하여 HTML 추출 (최대 30초 대기)
    // 폴백: <pre> 코드 블록에서 가장 긴 텍스트 추출
    let extractedHtml: string | null = null;

    for (let attempt = 0; attempt < ARTIFACT_MAX_RETRIES; attempt++) {
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
      if (attempt < ARTIFACT_MAX_RETRIES - 1) {
        console.log(`  > render_code_block: Artifact iframe 대기 중... (${attempt + 1}/${ARTIFACT_MAX_RETRIES})`);
        await page.waitForTimeout(ARTIFACT_POLL_INTERVAL_MS);
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
      await page.waitForTimeout(SETTLE_AFTER_RENDER_MS);
    } else {
      console.warn('  ⚠️ render_code_block: 코드 블록/Artifact를 찾을 수 없음');
    }
  },

  async executeOffscreen(_page, _action, _ctx: OffscreenContext) {
    // 순수 시각 효과, 페이지 상태에 영향 없음 → no-op
  },
};
