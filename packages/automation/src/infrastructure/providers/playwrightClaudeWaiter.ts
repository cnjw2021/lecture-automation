import { Page } from 'playwright';

/**
 * Claude.ai 응답 완료 감지 SSoT (#144 Phase 0d).
 *
 * streaming="true" → "false" 전이, 빈 그리팅 페이지 제외, Artifact/Prose 존재 휴리스틱.
 *
 * 두 호출 컨텍스트:
 *   - StepExecutor / Offscreen : timeout = 페이지 상태 불확실 → throw (세션 중단)
 *   - VisualProvider 녹화      : timeout 후에도 계속 진행 (단일 timeout 로 전체 파이프라인 죽이지 않음)
 *
 * 두 동작은 onTimeout 옵션으로 분기한다.
 */

export interface WaitForClaudeReadyOptions {
  /** 'throw': 타임아웃 시 Error throw. 'warn': console.warn 후 정상 리턴. 기본 'throw' */
  onTimeout?: 'throw' | 'warn';
}

const POLL_INTERVAL_MS = 10000;

const HINTS = [
  'Claude 응답 대기 중...',
  '시간이 조금 걸리고 있습니다...',
  '조금 더 기다려 봅시다...',
  '곧 응답이 돌아올 것 같습니다...',
  '응답 생성이 계속되고 있습니다, 잠시만요...',
];

export async function waitForClaudeReady(
  page: Page,
  timeoutMs: number,
  options: WaitForClaudeReadyOptions = {},
): Promise<void> {
  const onTimeout = options.onTimeout ?? 'throw';
  const startedAt = Date.now();
  const deadline = startedAt + timeoutMs;
  let attempt = 0;

  while (Date.now() < deadline) {
    const state = await page.evaluate(() => {
      const streamingTrue = document.querySelector('[data-is-streaming="true"]');
      if (streamingTrue) return 'streaming';

      const emptyGreeting = Array.from(document.querySelectorAll('h1, h2, p, div'))
        .find(el => {
          const t = (el.textContent || '').trim();
          return t === '本日はどのようなお手伝いができますか？'
            || t === 'How can I help you today?'
            || t.startsWith('本日はどのような');
        });
      if (emptyGreeting) return 'empty';

      const streamingFalse = document.querySelector('[data-is-streaming="false"]');
      if (streamingFalse) return 'ready';

      const hasArtifact = !!document.querySelector(
        '[aria-label*="artifact" i], [class*="artifact-block" i], button[aria-label*="アーティファクト"]'
      );
      const hasProse = document.querySelectorAll('.prose, [class*="message-"]').length > 0;
      if (hasArtifact || hasProse) return 'ready';

      return 'unknown';
    }).catch(() => 'unknown');

    if (state === 'ready') {
      const elapsed = Math.round((Date.now() - startedAt) / 1000);
      console.log(`  > Claude 응답 준비 완료 (경과: ${elapsed}s)`);
      return;
    }

    const hint = HINTS[Math.min(attempt, HINTS.length - 1)];
    const elapsed = Math.round((Date.now() - startedAt) / 1000);
    console.log(`  > ${hint} (상태: ${state}, 경과: ${elapsed}s)`);
    attempt++;
    await page.waitForTimeout(POLL_INTERVAL_MS);
  }

  if (onTimeout === 'throw') {
    throw new Error(
      `Claude 응답 대기 타임아웃 (${timeoutMs}ms) — 페이지 상태 불확실, 세션 중단`,
    );
  }
  console.warn(`  ⚠️ Claude 응답 대기 타임아웃 (${timeoutMs}ms) — 계속 진행`);
}
