/**
 * 브라우저 인증 상태 저장 CLI
 *
 * headed 브라우저를 열고 사용자가 수동 로그인한 뒤,
 * storageState(쿠키+localStorage)를 JSON으로 저장한다.
 *
 * 사용법:
 *   npx tsx packages/automation/src/presentation/cli/save-auth.ts <service> [url]
 *
 * 예시:
 *   npx tsx ... claude https://claude.ai
 *   npx tsx ... chatgpt https://chatgpt.com
 *   npx tsx ... codepen https://codepen.io/login
 */

import { chromium } from 'playwright';
import * as path from 'path';
import * as fs from 'fs-extra';
import * as os from 'os';
import * as readline from 'readline';

const ROOT_DIR = path.resolve(__dirname, '../../../../..');

async function main() {
  const service = process.argv[2];
  const url = process.argv[3] || getDefaultUrl(service);

  if (!service) {
    console.error('❌ 서비스명을 지정해 주세요.');
    console.error('   예: npx tsx save-auth.ts claude');
    console.error('       npx tsx save-auth.ts chatgpt');
    process.exit(1);
  }

  const outputPath = path.join(ROOT_DIR, 'config', 'auth', `${service}.json`);
  await fs.ensureDir(path.dirname(outputPath));

  console.log(`🔐 ${service} 인증 상태 저장`);
  console.log(`   URL: ${url}`);
  console.log(`   저장 경로: ${outputPath}`);
  console.log('');

  // 임시 유저 데이터 디렉토리 — persistent context로 자동화 플래그 제거
  const userDataDir = path.join(os.tmpdir(), `pw-auth-${service}-${Date.now()}`);

  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    channel: 'chrome',
    viewport: null,
    locale: 'ja-JP',
    timezoneId: 'Asia/Tokyo',
    args: [
      '--start-maximized',
      '--disable-blink-features=AutomationControlled',
    ],
    ignoreDefaultArgs: ['--enable-automation', '--no-sandbox'],
  });

  const page = context.pages()[0] || await context.newPage();
  await page.goto(url, { waitUntil: 'load', timeout: 30000 });

  console.log('🌐 브라우저가 열렸습니다. 로그인을 완료한 뒤 터미널에서 Enter를 눌러 주세요.');
  console.log('   (로그인 상태가 저장됩니다)');

  await waitForEnter();

  await context.storageState({ path: outputPath });
  console.log(`✅ 인증 상태 저장 완료: ${outputPath}`);

  await context.close();

  // 임시 디렉토리 정리
  await fs.remove(userDataDir).catch(() => {});
}

function getDefaultUrl(service?: string): string {
  switch (service) {
    case 'claude': return 'https://claude.ai';
    case 'chatgpt': return 'https://chatgpt.com';
    case 'codepen': return 'https://codepen.io/login';
    default: return 'https://example.com';
  }
}

function waitForEnter(): Promise<void> {
  return new Promise(resolve => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question('   → Enter를 누르면 저장합니다... ', () => {
      rl.close();
      resolve();
    });
  });
}

main().catch(err => {
  console.error('❌ 에러:', err.message);
  process.exit(1);
});
