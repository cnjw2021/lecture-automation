/**
 * Claude storageState의 기본 모델을 변경하는 자동화 CLI.
 *
 * 기존 config/auth/claude.json을 재사용하여 로그인 상태를 유지한 채,
 * Playwright로 모델 선택기를 조작해 지정한 모델을 기본값으로 설정한 뒤
 * 새 storageState를 동일 경로에 덮어쓴다.
 *
 * 사용법:
 *   npx tsx packages/automation/src/presentation/cli/switch-claude-model.ts "Haiku 4.5"
 *
 * 인자 생략 시 기본값 "Haiku 4.5".
 */

import { chromium } from 'playwright';
import * as path from 'path';
import * as fs from 'fs-extra';

const ROOT_DIR = path.resolve(__dirname, '../../../../..');
const STORAGE_STATE_PATH = path.join(ROOT_DIR, 'config/auth/claude.json');

async function main() {
  const targetModel = process.argv[2] || 'Haiku 4.5';

  if (!await fs.pathExists(STORAGE_STATE_PATH)) {
    console.error(`❌ storageState 없음: ${STORAGE_STATE_PATH}`);
    console.error('   먼저 save-auth 명령으로 기본 인증 상태를 만들어 주세요.');
    process.exit(1);
  }

  console.log(`🔧 Claude 기본 모델 변경: → ${targetModel}`);
  console.log(`   storageState: ${STORAGE_STATE_PATH}`);

  const browser = await chromium.launch({
    headless: false,
    channel: 'chrome',
    args: ['--disable-blink-features=AutomationControlled'],
  });

  const context = await browser.newContext({
    storageState: STORAGE_STATE_PATH,
    locale: 'ja-JP',
    timezoneId: 'Asia/Tokyo',
    viewport: { width: 1440, height: 900 },
  });

  const page = await context.newPage();

  console.log('  > Claude 홈 이동...');
  await page.goto('https://claude.ai/new', { waitUntil: 'load', timeout: 30000 });
  await page.waitForTimeout(3000);

  console.log('  > 모델 선택기 클릭...');
  // 현재 모델 라벨이 표시된 버튼을 찾는다 (Opus/Sonnet/Haiku 등)
  const modelButton = page.locator('button').filter({ hasText: /Opus|Sonnet|Haiku/ }).first();
  await modelButton.waitFor({ state: 'visible', timeout: 10000 });
  await modelButton.click();
  await page.waitForTimeout(1500);

  console.log(`  > "${targetModel}" 옵션 탐색...`);
  // 드롭다운에 직접 타겟 모델이 안 보이면 "その他のモデル" 서브메뉴를 먼저 펼친다
  const directOption = page.getByText(targetModel, { exact: false }).filter({ visible: true }).first();
  const visible = await directOption.isVisible().catch(() => false);

  if (!visible) {
    console.log('  > 직접 찾지 못함 → "その他のモデル" / "More models" 서브메뉴 열기 시도');
    const moreMenu = page.getByText(/その他のモデル|他のモデル|More models|その他/i).filter({ visible: true }).first();
    if (await moreMenu.isVisible().catch(() => false)) {
      await moreMenu.click();
      await page.waitForTimeout(1000);
    } else {
      console.log('  > 스크린샷 저장 (디버그용)');
      await page.screenshot({ path: '/tmp/claude-model-dropdown.png', fullPage: true });
      console.log('  > /tmp/claude-model-dropdown.png 확인 후 셀렉터 조정 필요');
    }
  }

  // 최종 클릭
  const option = page.getByText(targetModel, { exact: false }).filter({ visible: true }).first();
  await option.waitFor({ state: 'visible', timeout: 10000 });
  await option.click();
  await page.waitForTimeout(2000);

  console.log('  > 선택 확정 대기 (클릭이 네비게이션을 유발할 수 있음)...');
  await page.waitForTimeout(3000);

  // 프레임이 분리되지 않았으면 goto로 새 페이지 로드 후 라벨 검증
  try {
    await page.goto('https://claude.ai/new', { waitUntil: 'load', timeout: 20000 });
    await page.waitForTimeout(2000);
    const currentLabel = await page
      .locator('button')
      .filter({ hasText: /Opus|Sonnet|Haiku/ })
      .first()
      .textContent({ timeout: 5000 });
    console.log(`  > 현재 모델 버튼 라벨: "${currentLabel?.trim()}"`);
    if (!currentLabel?.includes(targetModel)) {
      console.warn(`  ⚠️ 라벨 매칭 실패. 그래도 storageState는 저장합니다.`);
    }
  } catch (e) {
    console.warn(`  ⚠️ 검증 단계 스킵 (${(e as Error).message.split('\n')[0]})`);
  }

  await context.storageState({ path: STORAGE_STATE_PATH });
  console.log(`✅ storageState 저장 완료: ${STORAGE_STATE_PATH}`);

  // 사이드바-닫힌 캐시 파일 제거 (다음 실행에서 재생성되도록)
  const sidebarClosedPath = STORAGE_STATE_PATH.replace(/\.json$/, '.sidebar-closed.json');
  if (await fs.pathExists(sidebarClosedPath)) {
    await fs.remove(sidebarClosedPath);
    console.log(`🧹 낡은 사이드바 캐시 삭제: ${sidebarClosedPath}`);
  }

  await browser.close();
}

main().catch(err => {
  console.error('❌ 에러:', err);
  process.exit(1);
});
