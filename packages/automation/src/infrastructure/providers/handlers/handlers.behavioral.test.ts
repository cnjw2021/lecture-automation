import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs-extra';
import { waitHandler } from './waitHandler';
import { scrollHandler } from './scrollHandler';
import { pressHandler } from './pressHandler';
import { captureHandler } from './captureHandler';
import { gotoHandler } from './gotoHandler';
import { CursorPosition } from '../../../domain/entities/StepManifest';

/**
 * 대표 핸들러 단위 테스트.
 * 전체 21 핸들러를 모두 커버하지는 않지만, 인터페이스 계약 (return shape, side effects)
 * 의 회귀를 잡아내기 위한 표본.
 */

function makeFakePage() {
  const calls: { method: string; args: any[] }[] = [];
  const fakePage: any = {
    screenshot: jest.fn(async (opts: any) => {
      calls.push({ method: 'screenshot', args: [opts] });
      // 실제 파일 생성: outputDir 검증
      await fs.ensureFile(opts.path);
    }),
    waitForTimeout: jest.fn(async (ms: number) => {
      calls.push({ method: 'waitForTimeout', args: [ms] });
    }),
    mouse: {
      wheel: jest.fn(async (...args: any[]) => calls.push({ method: 'wheel', args })),
      move: jest.fn(async (...args: any[]) => calls.push({ method: 'move', args })),
      down: jest.fn(async () => calls.push({ method: 'down', args: [] })),
      up: jest.fn(async () => calls.push({ method: 'up', args: [] })),
    },
    keyboard: {
      press: jest.fn(async (key: string) => calls.push({ method: 'press', args: [key] })),
    },
    goto: jest.fn(async (url: string, opts: any) => {
      calls.push({ method: 'goto', args: [url, opts] });
    }),
    locator: jest.fn(),
    url: jest.fn(() => 'https://example.com'),
  };
  return { fakePage, calls };
}

function makeCtx(outputDir: string) {
  const cursor: CursorPosition = { x: 100, y: 100 };
  return {
    stepIndex: 3,
    outputDir,
    cursorPos: cursor,
  };
}

describe('waitHandler', () => {
  let tmp: string;
  beforeEach(async () => { tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'pw-handler-')); });
  afterEach(async () => { if (tmp) await fs.remove(tmp); });

  it('executeForCapture: action.ms 가 durationMs 로 반영된다', async () => {
    const { fakePage } = makeFakePage();
    const step = await waitHandler.executeForCapture(fakePage, { cmd: 'wait', ms: 1234 }, makeCtx(tmp));
    expect(step).toMatchObject({
      cmd: 'wait',
      durationMs: 1234,
      cursorFrom: { x: 100, y: 100 },
      cursorTo: { x: 100, y: 100 },
    });
  });

  it('executeForCapture: ms 누락 시 디폴트 1000', async () => {
    const { fakePage } = makeFakePage();
    const step = await waitHandler.executeForCapture(fakePage, { cmd: 'wait' }, makeCtx(tmp));
    expect(step?.durationMs).toBe(1000);
  });

  it('executeForRecording: action.ms 만큼 waitForTimeout 호출', async () => {
    const { fakePage } = makeFakePage();
    await waitHandler.executeForRecording(fakePage, { cmd: 'wait', ms: 500 }, {} as any);
    expect(fakePage.waitForTimeout).toHaveBeenCalledWith(500);
  });

  it('executeForRecording: ms 누락 시 waitForTimeout 호출되지 않음', async () => {
    const { fakePage } = makeFakePage();
    await waitHandler.executeForRecording(fakePage, { cmd: 'wait' }, {} as any);
    expect(fakePage.waitForTimeout).not.toHaveBeenCalled();
  });
});

describe('scrollHandler', () => {
  it('executeForCapture: deltaY 누락 시 300 사용', async () => {
    const { fakePage } = makeFakePage();
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'pw-handler-'));
    await scrollHandler.executeForCapture(fakePage, { cmd: 'scroll' }, makeCtx(tmp));
    expect(fakePage.mouse.wheel).toHaveBeenCalledWith(0, 300);
    await fs.remove(tmp);
  });

  it('executeForRecording: deltaY 가 그대로 mouse.wheel 에 전달된다', async () => {
    const { fakePage } = makeFakePage();
    await scrollHandler.executeForRecording(fakePage, { cmd: 'scroll', deltaY: -200 }, {} as any);
    expect(fakePage.mouse.wheel).toHaveBeenCalledWith(0, -200);
  });
});

describe('pressHandler', () => {
  it('executeForCapture: action.key 누락 시 null 반환', async () => {
    const { fakePage } = makeFakePage();
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'pw-handler-'));
    const step = await pressHandler.executeForCapture(fakePage, { cmd: 'press' }, makeCtx(tmp));
    expect(step).toBeNull();
    await fs.remove(tmp);
  });

  it('executeForRecording: keyboard.press 가 호출된다', async () => {
    const { fakePage } = makeFakePage();
    await pressHandler.executeForRecording(fakePage, { cmd: 'press', key: 'Enter' }, {} as any);
    expect(fakePage.keyboard.press).toHaveBeenCalledWith('Enter');
  });
});

describe('captureHandler', () => {
  let tmp: string;
  beforeEach(async () => { tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'pw-handler-')); });
  afterEach(async () => { if (tmp) await fs.remove(tmp); });

  it('executeForCapture: saveAs 누락 시 null 반환 + warn', async () => {
    const { fakePage } = makeFakePage();
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const step = await captureHandler.executeForCapture(
      fakePage,
      { cmd: 'capture' },
      { ...makeCtx(tmp), lectureId: 'lec-test' },
    );
    expect(step).toBeNull();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('saveAs'));
    warn.mockRestore();
  });

  it('executeForCapture: lectureId 누락 시 throw', async () => {
    const { fakePage } = makeFakePage();
    await expect(
      captureHandler.executeForCapture(
        fakePage,
        { cmd: 'capture', saveAs: 'k', fromUrl: true },
        makeCtx(tmp),
      ),
    ).rejects.toThrow(/lectureId 가 필요합니다/);
  });
});

describe('gotoHandler', () => {
  let tmp: string;
  beforeEach(async () => { tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'pw-handler-')); });
  afterEach(async () => { if (tmp) await fs.remove(tmp); });

  it('executeForCapture: action.url 없으면 null 반환', async () => {
    const { fakePage } = makeFakePage();
    const step = await gotoHandler.executeForCapture(fakePage, { cmd: 'goto' }, makeCtx(tmp));
    expect(step).toBeNull();
  });

  it('executeForRecording: urlFromScene 미해결 + url 없음 → 조기 리턴', async () => {
    const { fakePage } = makeFakePage();
    const recordCtx = {
      sceneId: 1,
      injectCursor: jest.fn(),
      resolveUrlFromScene: jest.fn().mockReturnValue(undefined),
      checkSessionExpired: jest.fn(),
      waitForClaudeReady: jest.fn(),
    } as any;
    await gotoHandler.executeForRecording(
      fakePage,
      { cmd: 'goto', urlFromScene: 5 },
      recordCtx,
    );
    expect(fakePage.goto).not.toHaveBeenCalled();
    expect(recordCtx.injectCursor).not.toHaveBeenCalled();
  });

  it('executeForRecording: urlFromScene 해결 시 그 URL 로 goto + injectCursor', async () => {
    const { fakePage } = makeFakePage();
    const recordCtx = {
      sceneId: 1,
      injectCursor: jest.fn(),
      resolveUrlFromScene: jest.fn().mockReturnValue('https://resolved.example.com'),
      checkSessionExpired: jest.fn(),
      waitForClaudeReady: jest.fn(),
    } as any;
    await gotoHandler.executeForRecording(
      fakePage,
      { cmd: 'goto', urlFromScene: 5 },
      recordCtx,
    );
    expect(fakePage.goto).toHaveBeenCalledWith('https://resolved.example.com', expect.any(Object));
    expect(recordCtx.injectCursor).toHaveBeenCalled();
  });

  it('executeForRecording: hasStorageState true 시 checkSessionExpired 호출', async () => {
    const { fakePage } = makeFakePage();
    const recordCtx = {
      sceneId: 1,
      hasStorageState: true,
      injectCursor: jest.fn(),
      resolveUrlFromScene: jest.fn(),
      checkSessionExpired: jest.fn(),
      waitForClaudeReady: jest.fn(),
    } as any;
    await gotoHandler.executeForRecording(
      fakePage,
      { cmd: 'goto', url: 'https://example.com' },
      recordCtx,
    );
    expect(recordCtx.checkSessionExpired).toHaveBeenCalledWith('https://example.com');
  });
});
