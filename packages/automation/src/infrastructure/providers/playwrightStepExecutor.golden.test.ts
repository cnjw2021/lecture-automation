import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs-extra';
import {
  executeAndCaptureStep,
  executeActionOffscreen,
  StepCaptureContext,
} from './playwrightStepExecutor';
import { PlaywrightAction } from '../../domain/entities/Lecture';
import { makeFakePage } from './fakePage';

/**
 * 골든 회귀 테스트 (#144 Phase 0d/0e 안전망).
 *
 * 21 PlaywrightCmd 각각에 대해 (입력 액션 → 출력 StepData) 를 명시적 expected 로
 * 잠가 둔다. 핸들러 내부 구현이 바뀌면서 StepData shape 이 미묘하게 달라지면
 * 즉시 실패한다.
 *
 * 검증 대상:
 *   - StepData 모든 필드 (cmd, screenshot, cursorFrom/To, targetBox, durationMs,
 *     scrollY, isClick, isHighlight, note)
 *   - Page side effects 의 핵심 호출 순서 (screenshot 가 액션 전에/후에 호출되는지 등)
 *   - capture / right_click 의 디스크 saveCapture 결과
 */

describe('executeAndCaptureStep golden output (21 cmds)', () => {
  let tmp: string;
  let captureRoot: string;

  beforeEach(async () => {
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'pw-golden-'));
    captureRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'pw-cap-root-'));
    // saveCapture 가 process.cwd() 기준이라 cwd 를 임시 디렉터리로 옮긴다.
    process.chdir(captureRoot);
  });
  afterEach(async () => {
    if (tmp) await fs.remove(tmp);
    if (captureRoot) await fs.remove(captureRoot);
  });

  function ctx(overrides: Partial<StepCaptureContext> = {}): StepCaptureContext {
    return {
      stepIndex: 7,
      outputDir: tmp,
      cursorPos: { x: 100, y: 100 },
      lectureId: 'lec-test',
      sceneId: 5,
      ...overrides,
    };
  }

  // ---- 1) goto -------------------------------------------------------

  it('goto', async () => {
    const page = makeFakePage();
    const action: PlaywrightAction = { cmd: 'goto', url: 'https://example.com', note: 'open' };
    const out = await executeAndCaptureStep(page as any, action, ctx());
    expect(out).toEqual({
      index: 7,
      cmd: 'goto',
      screenshot: 'step-7.png',
      cursorFrom: { x: 100, y: 100 },
      cursorTo: { x: 100, y: 100 },
      scrollY: 0,
      durationMs: 1000,
      note: 'open',
    });
    // page.goto 가 screenshot 전에 호출됐는지 순서 검증
    const order = (page as any).calls.map((c: any) => c.method);
    expect(order.indexOf('goto')).toBeLessThan(order.indexOf('screenshot'));
  });

  it('goto: url 누락 시 null', async () => {
    const out = await executeAndCaptureStep(makeFakePage() as any, { cmd: 'goto' }, ctx());
    expect(out).toBeNull();
  });

  // ---- 2) prefill_codepen -------------------------------------------

  it('prefill_codepen: codepen 도달 검증은 brower utils 에 위임. StepData shape 만 잠금', async () => {
    // executeCodepenPrefill 는 page.goto / page.evaluate 를 호출. fake page 가 안전하게 흡수.
    const page = makeFakePage();
    const action: PlaywrightAction = {
      cmd: 'prefill_codepen',
      html: '<h1>x</h1>',
      css: 'h1{color:red}',
      js: '',
      editors: '110',
      note: 'pen',
    };
    const out = await executeAndCaptureStep(page as any, action, ctx());
    expect(out).toEqual({
      index: 7,
      cmd: 'prefill_codepen',
      screenshot: 'step-7.png',
      cursorFrom: { x: 100, y: 100 },
      cursorTo: { x: 100, y: 100 },
      scrollY: 0,
      durationMs: 4500,
      note: 'pen',
    });
  });

  // ---- 3) wait -------------------------------------------------------

  it('wait: ms 가 durationMs 로 반영', async () => {
    const out = await executeAndCaptureStep(
      makeFakePage() as any,
      { cmd: 'wait', ms: 2500, note: 'pause' },
      ctx(),
    );
    expect(out).toEqual({
      index: 7,
      cmd: 'wait',
      screenshot: 'step-7.png',
      cursorFrom: { x: 100, y: 100 },
      cursorTo: { x: 100, y: 100 },
      durationMs: 2500,
      note: 'pause',
    });
  });

  it('wait: ms 누락 시 디폴트 1000', async () => {
    const out = await executeAndCaptureStep(
      makeFakePage() as any,
      { cmd: 'wait' },
      ctx(),
    );
    expect(out?.durationMs).toBe(1000);
  });

  // ---- 4) wait_for ---------------------------------------------------

  it('wait_for: durationMs 는 최소 500', async () => {
    const page = makeFakePage();
    const out = await executeAndCaptureStep(
      page as any,
      { cmd: 'wait_for', selector: '#ready', state: 'visible', timeout: 1000 },
      ctx(),
    );
    expect(out).toMatchObject({
      index: 7,
      cmd: 'wait_for',
      screenshot: 'step-7.png',
      cursorFrom: { x: 100, y: 100 },
      cursorTo: { x: 100, y: 100 },
    });
    expect(out!.durationMs).toBeGreaterThanOrEqual(500);
  });

  it('wait_for: selector 누락 시 null', async () => {
    const out = await executeAndCaptureStep(
      makeFakePage() as any,
      { cmd: 'wait_for' },
      ctx(),
    );
    expect(out).toBeNull();
  });

  // ---- 5) wait_for_claude_ready --------------------------------------

  it('wait_for_claude_ready: ready 즉시 반환', async () => {
    const page = makeFakePage({
      // claude waiter 는 page.evaluate 를 호출해 상태 문자열을 받는다. 'ready' 즉시 반환.
      evaluateImpl: () => 'ready',
    });
    const out = await executeAndCaptureStep(
      page as any,
      { cmd: 'wait_for_claude_ready', timeout: 5000, note: 'wait' },
      ctx(),
    );
    expect(out).toMatchObject({
      index: 7,
      cmd: 'wait_for_claude_ready',
      screenshot: 'step-7.png',
      cursorFrom: { x: 100, y: 100 },
      cursorTo: { x: 100, y: 100 },
      note: 'wait',
    });
    expect(out!.durationMs).toBeGreaterThanOrEqual(500);
  });

  // ---- 6) scroll -----------------------------------------------------

  it('scroll: deltaY 만큼 wheel + 300ms settle', async () => {
    const page = makeFakePage();
    const out = await executeAndCaptureStep(
      page as any,
      { cmd: 'scroll', deltaY: -200, note: 'up' },
      ctx(),
    );
    expect(out).toEqual({
      index: 7,
      cmd: 'scroll',
      screenshot: 'step-7.png',
      cursorFrom: { x: 100, y: 100 },
      cursorTo: { x: 100, y: 100 },
      durationMs: 500,
      note: 'up',
    });
    expect((page as any).calls.find((c: any) => c.method === 'mouse.wheel')).toMatchObject({
      args: [0, -200],
    });
  });

  // ---- 7) mouse_move -------------------------------------------------

  it('mouse_move: cursorTo = action.to', async () => {
    const out = await executeAndCaptureStep(
      makeFakePage() as any,
      { cmd: 'mouse_move', to: [400, 300], note: 'move' },
      ctx(),
    );
    expect(out).toEqual({
      index: 7,
      cmd: 'mouse_move',
      screenshot: 'step-7.png',
      cursorFrom: { x: 100, y: 100 },
      cursorTo: { x: 400, y: 300 },
      durationMs: 700,
      note: 'move',
    });
  });

  // ---- 8) click ------------------------------------------------------

  it('click: cursorTo = box 중심, targetBox 정의', async () => {
    const page = makeFakePage({
      boxes: { '#btn': { x: 100, y: 200, width: 80, height: 40 } },
    });
    const out = await executeAndCaptureStep(
      page as any,
      { cmd: 'click', selector: '#btn', note: 'submit' },
      ctx(),
    );
    expect(out).toEqual({
      index: 7,
      cmd: 'click',
      screenshot: 'step-7.png',
      cursorFrom: { x: 100, y: 100 },
      cursorTo: { x: 140, y: 220 },
      targetBox: { x: 100, y: 200, width: 80, height: 40 },
      durationMs: 500,
      isClick: true,
      note: 'submit',
    });
  });

  it('click: box 가 없으면 cursorTo = cursorFrom + targetBox undefined', async () => {
    const page = makeFakePage();
    const out = await executeAndCaptureStep(
      page as any,
      { cmd: 'click', selector: '#missing' },
      ctx(),
    );
    expect(out).toMatchObject({
      cursorTo: { x: 100, y: 100 },
      targetBox: undefined,
      isClick: true,
    });
  });

  // ---- 9) type -------------------------------------------------------

  it('type: durationMs 는 char × 120 (최소 500)', async () => {
    const page = makeFakePage({
      boxes: { '#input': { x: 0, y: 0, width: 200, height: 30 } },
    });
    const out = await executeAndCaptureStep(
      page as any,
      { cmd: 'type', selector: '#input', key: 'hello world', note: 'typing' },
      ctx(),
    );
    expect(out).toEqual({
      index: 7,
      cmd: 'type',
      screenshot: 'step-7.png',
      cursorFrom: { x: 100, y: 100 },
      cursorTo: { x: 100, y: 15 },
      targetBox: { x: 0, y: 0, width: 200, height: 30 },
      durationMs: 11 * 120,  // 1320
      note: 'typing',
    });
  });

  it('type: 짧은 key 는 최소 500ms', async () => {
    const page = makeFakePage({
      boxes: { '#input': { x: 0, y: 0, width: 100, height: 20 } },
    });
    const out = await executeAndCaptureStep(
      page as any,
      { cmd: 'type', selector: '#input', key: 'a' },
      ctx(),
    );
    expect(out!.durationMs).toBe(500);
  });

  // ---- 10) focus -----------------------------------------------------

  it('focus: cursorTo = box 중심, durationMs=300', async () => {
    const page = makeFakePage({
      boxes: { '#field': { x: 50, y: 50, width: 100, height: 40 } },
    });
    const out = await executeAndCaptureStep(
      page as any,
      { cmd: 'focus', selector: '#field' },
      ctx(),
    );
    expect(out).toEqual({
      index: 7,
      cmd: 'focus',
      screenshot: 'step-7.png',
      cursorFrom: { x: 100, y: 100 },
      cursorTo: { x: 100, y: 70 },
      targetBox: { x: 50, y: 50, width: 100, height: 40 },
      durationMs: 300,
      note: undefined,
    });
  });

  // ---- 11) mouse_drag ------------------------------------------------

  it('mouse_drag: cursorFrom/To = action.from/to, durationMs=800', async () => {
    const out = await executeAndCaptureStep(
      makeFakePage() as any,
      { cmd: 'mouse_drag', from: [10, 20], to: [110, 220], note: 'drag' },
      ctx(),
    );
    expect(out).toEqual({
      index: 7,
      cmd: 'mouse_drag',
      screenshot: 'step-7.png',
      cursorFrom: { x: 10, y: 20 },
      cursorTo: { x: 110, y: 220 },
      durationMs: 800,
      note: 'drag',
    });
  });

  // ---- 12) press -----------------------------------------------------

  it('press: durationMs=300, cursorTo=cursorFrom', async () => {
    const out = await executeAndCaptureStep(
      makeFakePage() as any,
      { cmd: 'press', key: 'Enter', note: 'enter' },
      ctx(),
    );
    expect(out).toEqual({
      index: 7,
      cmd: 'press',
      screenshot: 'step-7.png',
      cursorFrom: { x: 100, y: 100 },
      cursorTo: { x: 100, y: 100 },
      durationMs: 300,
      note: 'enter',
    });
  });

  it('press: key 누락 시 null', async () => {
    const out = await executeAndCaptureStep(makeFakePage() as any, { cmd: 'press' }, ctx());
    expect(out).toBeNull();
  });

  // ---- 13) highlight -------------------------------------------------

  it('highlight: targetBox + isHighlight=true + durationMs=1500', async () => {
    const page = makeFakePage({
      boxes: { '.tag': { x: 200, y: 100, width: 50, height: 25 } },
    });
    const out = await executeAndCaptureStep(
      page as any,
      { cmd: 'highlight', selector: '.tag', note: 'show' },
      ctx(),
    );
    expect(out).toEqual({
      index: 7,
      cmd: 'highlight',
      screenshot: 'step-7.png',
      cursorFrom: { x: 100, y: 100 },
      cursorTo: { x: 100, y: 100 },
      targetBox: { x: 200, y: 100, width: 50, height: 25 },
      durationMs: 1500,
      isHighlight: true,
      note: 'show',
    });
  });

  // ---- 14-16) open/select/toggle_devtools_node -----------------------

  it.each([
    ['open_devtools', { cmd: 'open_devtools' as const }],
    ['select_devtools_node', { cmd: 'select_devtools_node' as const, selector: '#x' }],
    ['toggle_devtools_node', { cmd: 'toggle_devtools_node' as const, selector: '#x', mode: 'expand' as const }],
  ])('%s: result.ok=true 시 step 생성', async (label, action) => {
    const page = makeFakePage({ evaluateImpl: () => ({ ok: true }) });
    const out = await executeAndCaptureStep(page as any, action, ctx());
    expect(out).toMatchObject({
      index: 7,
      cmd: label,
      screenshot: 'step-7.png',
      cursorFrom: { x: 100, y: 100 },
      cursorTo: { x: 100, y: 100 },
    });
  });

  it('open_devtools: result.ok=false 시 null', async () => {
    const page = makeFakePage({ evaluateImpl: () => ({ ok: false, reason: 'x' }) });
    const out = await executeAndCaptureStep(
      page as any,
      { cmd: 'open_devtools' },
      ctx(),
    );
    expect(out).toBeNull();
  });

  // ---- 17) disable_css ----------------------------------------------

  it('disable_css', async () => {
    const out = await executeAndCaptureStep(
      makeFakePage() as any,
      { cmd: 'disable_css', note: 'off' },
      ctx(),
    );
    expect(out).toEqual({
      index: 7,
      cmd: 'disable_css',
      screenshot: 'step-7.png',
      cursorFrom: { x: 100, y: 100 },
      cursorTo: { x: 100, y: 100 },
      durationMs: 500,
      note: 'off',
    });
  });

  // ---- 18) enable_css ----------------------------------------------

  it('enable_css', async () => {
    const out = await executeAndCaptureStep(
      makeFakePage() as any,
      { cmd: 'enable_css' },
      ctx(),
    );
    expect(out).toEqual({
      index: 7,
      cmd: 'enable_css',
      screenshot: 'step-7.png',
      cursorFrom: { x: 100, y: 100 },
      cursorTo: { x: 100, y: 100 },
      durationMs: 500,
      note: undefined,
    });
  });

  // ---- 19) render_code_block ----------------------------------------

  it('render_code_block: capture 모드는 항상 null (manifest step 없음)', async () => {
    const page = makeFakePage();
    const out = await executeAndCaptureStep(
      page as any,
      { cmd: 'render_code_block' },
      ctx(),
    );
    expect(out).toBeNull();
  });

  // ---- 20) capture --------------------------------------------------

  it('capture (selector + attribute): saveCapture 후 null 반환', async () => {
    const page = makeFakePage({
      attributes: { '#photo': { src: 'photo-12345-abc.jpg' } },
    });
    const out = await executeAndCaptureStep(
      page as any,
      {
        cmd: 'capture',
        selector: '#photo',
        attribute: 'src',
        saveAs: 'photo_id',
        transform: { type: 'regex', pattern: '(photo-\\d+)' },
      },
      ctx(),
    );
    expect(out).toBeNull();
    // saveCapture 가 디스크에 기록했는지 확인
    const captured = await fs.readJson(
      path.join(captureRoot, 'tmp', 'playwright-captures', 'lec-test', 'photo_id.json'),
    );
    expect(captured.value).toBe('photo-12345');
    expect(captured.sceneId).toBe(5);
    expect(captured.sourceCmd).toBe('capture');
  });

  it('capture (fromUrl)', async () => {
    const page = makeFakePage({ url: 'https://claude.ai/chat/abcd-1234-uuid' });
    await executeAndCaptureStep(
      page as any,
      {
        cmd: 'capture',
        fromUrl: true,
        saveAs: 'conv',
        transform: {
          type: 'regex',
          pattern: '/chat/([\\w-]+)',
        },
      },
      ctx(),
    );
    const captured = await fs.readJson(
      path.join(captureRoot, 'tmp', 'playwright-captures', 'lec-test', 'conv.json'),
    );
    expect(captured.value).toBe('abcd-1234-uuid');
  });

  it('capture: saveAs 누락 시 null + warn', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const out = await executeAndCaptureStep(
      makeFakePage() as any,
      { cmd: 'capture' },
      ctx(),
    );
    expect(out).toBeNull();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('saveAs'));
    warn.mockRestore();
  });

  it('capture: lectureId 누락 시 throw', async () => {
    await expect(
      executeAndCaptureStep(
        makeFakePage() as any,
        { cmd: 'capture', saveAs: 'k', fromUrl: true },
        ctx({ lectureId: undefined }),
      ),
    ).rejects.toThrow(/lectureId 가 필요/);
  });

  // ---- 21) right_click ---------------------------------------------

  it('right_click: 메뉴 + captureFromTarget', async () => {
    const page = makeFakePage({
      boxes: { '#photo': { x: 600, y: 400, width: 200, height: 150 } },
      attributes: { '#photo': { src: 'photo-99999-xyz.jpg' } },
    });
    const out = await executeAndCaptureStep(
      page as any,
      {
        cmd: 'right_click',
        selector: '#photo',
        captureFromTarget: {
          attribute: 'src',
          saveAs: 'p',
          transform: { type: 'regex', pattern: '(photo-\\d+)' },
        },
        showContextMenu: {
          items: ['コピー', '画像のアドレスをコピー'],
          clickItem: '画像のアドレスをコピー',
          highlightDelayMs: 200,
          clickDelayMs: 500,
        },
        note: 'rc',
      },
      ctx(),
    );
    expect(out).toEqual({
      index: 7,
      cmd: 'right_click',
      screenshot: 'step-7.png',
      cursorFrom: { x: 100, y: 100 },
      cursorTo: { x: 700, y: 475 }, // box 중심
      targetBox: { x: 600, y: 400, width: 200, height: 150 },
      // base 1500 + highlightDelay 200 + clickDelay 500
      durationMs: 2200,
      isClick: true,
      note: 'rc',
    });
    // captureFromTarget 가 디스크에 저장됐는지
    const captured = await fs.readJson(
      path.join(captureRoot, 'tmp', 'playwright-captures', 'lec-test', 'p.json'),
    );
    expect(captured.value).toBe('photo-99999');
    expect(captured.sourceCmd).toBe('right_click');
  });

  it('right_click: 메뉴 없이 우클릭만 (durationMs=base)', async () => {
    const page = makeFakePage({
      boxes: { '#x': { x: 0, y: 0, width: 50, height: 50 } },
    });
    const out = await executeAndCaptureStep(
      page as any,
      { cmd: 'right_click', selector: '#x' },
      ctx(),
    );
    expect(out).toMatchObject({
      cmd: 'right_click',
      durationMs: 1500,
      isClick: true,
      cursorTo: { x: 25, y: 25 },
    });
  });

  it('right_click: visibleMs override 사용 시 base + visibleMs', async () => {
    const page = makeFakePage({
      boxes: { '#x': { x: 0, y: 0, width: 50, height: 50 } },
    });
    const out = await executeAndCaptureStep(
      page as any,
      {
        cmd: 'right_click',
        selector: '#x',
        showContextMenu: { items: ['A'], visibleMs: 3000 },
      },
      ctx(),
    );
    expect(out!.durationMs).toBe(1500 + 3000);
  });

  // ---- 미지원 cmd ------------------------------------------

  it('미지원 cmd 는 null + warn', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const out = await executeAndCaptureStep(
      makeFakePage() as any,
      { cmd: 'totally_not_a_cmd' as any },
      ctx(),
    );
    expect(out).toBeNull();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('미지원 Action'));
    warn.mockRestore();
  });
});

describe('executeActionOffscreen golden behavior', () => {
  let captureRoot: string;
  beforeEach(async () => {
    captureRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'pw-cap-off-'));
    process.chdir(captureRoot);
  });
  afterEach(async () => {
    if (captureRoot) await fs.remove(captureRoot);
  });

  it('wait: action.ms 만큼 waitForTimeout', async () => {
    const page = makeFakePage();
    await executeActionOffscreen(page as any, { cmd: 'wait', ms: 750 }, { lectureId: 'lec-test' });
    expect((page as any).calls).toContainEqual({ method: 'waitForTimeout', args: [750] });
  });

  it('right_click: offscreen 에서는 메뉴 미주입, captureFromTarget 만 수행', async () => {
    const page = makeFakePage({
      attributes: { '#photo': { src: 'photo-1' } },
    });
    await executeActionOffscreen(
      page as any,
      {
        cmd: 'right_click',
        selector: '#photo',
        captureFromTarget: { saveAs: 'p' },
        showContextMenu: { items: ['A'], clickItem: 'A' },
      },
      { lectureId: 'lec-test', sceneId: 1 },
    );
    // capture 됐는지
    const stored = await fs.readJson(
      path.join(captureRoot, 'tmp', 'playwright-captures', 'lec-test', 'p.json'),
    );
    expect(stored.value).toBe('photo-1');
    // 메뉴 주입(evaluate) 호출되지 않았는지 — offscreen 은 시각 효과 생략
    const evalCalls = (page as any).calls.filter((c: any) => c.method === 'evaluate');
    expect(evalCalls).toHaveLength(0);
  });

  it('render_code_block: offscreen 은 no-op', async () => {
    const page = makeFakePage();
    await executeActionOffscreen(page as any, { cmd: 'render_code_block' }, {});
    // page 가 어떤 동작도 받지 않아야 함
    expect((page as any).calls).toHaveLength(0);
  });

  it('미지원 cmd 는 warn + 정상 리턴', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    await executeActionOffscreen(
      makeFakePage() as any,
      { cmd: 'totally_not_a_cmd' as any },
      {},
    );
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('offscreen 미지원'));
    warn.mockRestore();
  });
});
