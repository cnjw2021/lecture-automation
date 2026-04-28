import { chromium, LaunchOptions, Locator } from 'playwright';
import * as path from 'path';
import * as fs from 'fs-extra';
import { config } from '../config';

/**
 * Playwright `pressSequentially` 는 per-character timeout 이 없어
 * CodeMirror auto-close-bracket / auto-close-tag race 등으로 textarea 가
 * 일시적으로 unresponsive 가 되면 다음 키 입력을 영원히 재시도한다.
 *
 * 이 헬퍼는 입력 길이에 비례하는 상한을 걸어 매달림을 강제 종료한다.
 * 정상 입력 속도(`delay: 100ms`)의 두 배 + 5초 여유를 기본으로 잡는다.
 *
 * timeout 발생 시 throw 하여 호출자가 fail-fast 처리하도록 한다.
 * webm 일부 입력 상태로 다음 단계가 진행되어 garbage 영상이 생기는 것을 막는다.
 */
export async function typeWithTimeout(
  locator: Locator,
  key: string,
  options: { delay?: number; selector?: string } = {},
): Promise<void> {
  const delay = options.delay ?? 100;
  const timeoutMs = key.length * (delay * 2) + 5000;
  let timeoutId: NodeJS.Timeout | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(
        `pressSequentially timeout (${timeoutMs}ms): ${key.length}자 입력 못 함` +
        (options.selector ? ` [selector=${options.selector}]` : ''),
      ));
    }, timeoutMs);
  });
  try {
    await Promise.race([
      locator.pressSequentially(key, { delay }),
      timeoutPromise,
    ]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

/**
 * storageState 경로를 절대 경로로 해결한다. 파일이 없으면 undefined を返す。
 */
export function resolveStorageState(storageState: string | undefined): string | undefined {
  if (!storageState) return undefined;
  const resolved = path.resolve(config.paths.root, storageState);
  if (!fs.existsSync(resolved)) {
    console.warn(`  ⚠️ storageState 파일 없음: ${resolved} (인증 없이 진행)`);
    return undefined;
  }
  return resolved;
}

/**
 * storageState 유무에 따라 브라우저 실행 옵션을 반환한다.
 * storageState 사용 시: 실제 Chrome + headed 모드 (Cloudflare Turnstile 통과 필수).
 */
export function buildLaunchOptions(hasStorageState: boolean): LaunchOptions {
  if (!hasStorageState) return { headless: true };
  return {
    headless: false,
    channel: 'chrome',
    args: ['--disable-blink-features=AutomationControlled'],
  };
}

/**
 * 녹화/캡처 전 프리플라이트: 사이드바를 닫은 상태의 storageState를 생성한다.
 * 임시 브라우저로 claude.ai/new 를 열어 localStorage의 사이드바 키를 false로 설정,
 * 갱신된 storageState를 `.sidebar-closed.json` 임시 파일로 저장하여 반환한다.
 */
export async function preflightCloseSidebar(
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

    await page.waitForTimeout(3000);

    const toggled = await page.evaluate(() => {
      const toggleBtn = document.querySelector('[data-testid="sidebar-toggle"]')
        || document.querySelector('[data-testid="close-sidebar"]')
        || document.querySelector('button[aria-label*="sidebar" i]')
        || document.querySelector('button[aria-label*="サイドバー"]');
      if (toggleBtn) {
        (toggleBtn as HTMLElement).click();
        return 'button-click';
      }
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.includes('chatControlsSidebarIsOpen')) {
          localStorage.setItem(key, 'false');
          return 'key-set: ' + key;
        }
      }
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('LSS-')) {
          const uuid = key.split(':')[0];
          const sidebarKey = uuid + ':chatControlsSidebarIsOpen';
          localStorage.setItem(sidebarKey, 'false');
          return 'key-created: ' + sidebarKey;
        }
      }
      return 'no-action';
    });
    console.log(`  > 프리플라이트 사이드바 처리: ${toggled}`);

    await page.waitForTimeout(1000);

    const updatedPath = storageStatePath.replace(/\.json$/, '.sidebar-closed.json');
    await ctx.storageState({ path: updatedPath });
    await ctx.close();
    console.log('  > 프리플라이트 완료: 사이드바 닫힌 상태 저장됨');
    return updatedPath;
  } finally {
    await browser.close();
  }
}
