import * as fs from 'fs-extra';

/**
 * 골든 회귀 테스트용 Playwright Page 모의체 (#144).
 *
 * 핸들러가 실제로 호출하는 메서드만 시뮬레이션한다:
 *   - goto / url / screenshot / waitForTimeout / setContent / frames / evaluate
 *   - mouse.wheel / move / down / up
 *   - keyboard.press
 *   - locator(selector).{ waitFor, boundingBox, click, focus, evaluate, getAttribute, pressSequentially }
 *
 * 결정적 출력을 위해:
 *   - boundingBox 는 셀렉터별로 사전 등록한 값을 반환 (없으면 null)
 *   - getAttribute 도 사전 등록한 값을 반환 (없으면 null)
 *   - evaluate 는 기본 { ok: true } 반환 (eduDevtools result.ok 체크 통과).
 *     테스트 별로 evaluateImpl 콜백 주입 가능.
 *   - 모든 호출은 page.calls 배열에 기록되어 추가 assertion 가능
 */

export interface FakeBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FakePageOptions {
  /** 초기 page.url() 반환값 */
  url?: string;
  /** Map<selector, FakeBox | null>. null 이면 boundingBox 가 null 반환. 미등록 셀렉터도 null. */
  boxes?: Record<string, FakeBox | null>;
  /** Map<selector, Map<attribute, value | null>> */
  attributes?: Record<string, Record<string, string | null>>;
  /** page.evaluate / locator.evaluate 의 응답을 동적으로 결정하고 싶을 때 */
  evaluateImpl?: (fn: any, arg: any) => any;
  /** page.frames() 가 반환할 프레임 배열 */
  frames?: any[];
}

export interface FakeCall {
  method: string;
  args: any[];
}

export class FakeLocator {
  constructor(public selector: string, private page: FakePage) {}

  waitFor = async (opts: any): Promise<void> => {
    this.page.calls.push({ method: `locator.waitFor`, args: [this.selector, opts] });
  };

  boundingBox = async (): Promise<FakeBox | null> => {
    this.page.calls.push({ method: `locator.boundingBox`, args: [this.selector] });
    return this.page.getBox(this.selector);
  };

  click = async (opts: any): Promise<void> => {
    this.page.calls.push({ method: `locator.click`, args: [this.selector, opts] });
  };

  focus = async (): Promise<void> => {
    this.page.calls.push({ method: `locator.focus`, args: [this.selector] });
  };

  evaluate = async (_fn: any): Promise<any> => {
    this.page.calls.push({ method: `locator.evaluate`, args: [this.selector] });
    return undefined;
  };

  getAttribute = async (attr: string): Promise<string | null> => {
    this.page.calls.push({ method: `locator.getAttribute`, args: [this.selector, attr] });
    return this.page.getAttribute(this.selector, attr);
  };

  pressSequentially = async (key: string, opts: any): Promise<void> => {
    this.page.calls.push({ method: `locator.pressSequentially`, args: [this.selector, key, opts] });
  };
}

export class FakePage {
  calls: FakeCall[] = [];
  private currentUrl: string;
  private boxes: Map<string, FakeBox | null>;
  private attrs: Map<string, Map<string, string | null>>;
  private evaluateImpl: (fn: any, arg: any) => any;
  private framesValue: any[];

  constructor(options: FakePageOptions = {}) {
    this.currentUrl = options.url ?? 'about:blank';
    this.boxes = new Map(Object.entries(options.boxes ?? {}));
    this.attrs = new Map(
      Object.entries(options.attributes ?? {}).map(([sel, m]) => [
        sel,
        new Map(Object.entries(m)),
      ]),
    );
    this.evaluateImpl = options.evaluateImpl ?? (() => ({ ok: true }));
    this.framesValue = options.frames ?? [];
  }

  /** 셀렉터별 boundingBox 등록. 미등록 = null */
  setBox(selector: string, box: FakeBox | null): void {
    this.boxes.set(selector, box);
  }
  getBox(selector: string): FakeBox | null {
    return this.boxes.has(selector) ? (this.boxes.get(selector) ?? null) : null;
  }

  setAttribute(selector: string, attr: string, value: string | null): void {
    if (!this.attrs.has(selector)) this.attrs.set(selector, new Map());
    this.attrs.get(selector)!.set(attr, value);
  }
  getAttribute(selector: string, attr: string): string | null {
    return this.attrs.get(selector)?.get(attr) ?? null;
  }

  setUrl(url: string): void {
    this.currentUrl = url;
  }

  // Page 메서드 ----------------------------------------------------------

  goto = async (url: string, opts?: any): Promise<void> => {
    this.calls.push({ method: 'goto', args: [url, opts] });
    this.currentUrl = url;
  };

  url = (): string => this.currentUrl;

  screenshot = async ({ path }: { path: string }): Promise<void> => {
    this.calls.push({ method: 'screenshot', args: [path] });
    // 실제 파일 생성 — outputDir 검증 + 후속 단계가 있으면 의미 가짐
    await fs.ensureFile(path);
  };

  waitForTimeout = async (ms: number): Promise<void> => {
    this.calls.push({ method: 'waitForTimeout', args: [ms] });
  };

  setContent = async (html: string, opts?: any): Promise<void> => {
    this.calls.push({ method: 'setContent', args: [html.slice(0, 80), opts] });
  };

  evaluate = async (fn: any, arg?: any): Promise<any> => {
    this.calls.push({ method: 'evaluate', args: [arg] });
    return this.evaluateImpl(fn, arg);
  };

  frames = (): any[] => this.framesValue;

  locator = (selector: string): FakeLocator => new FakeLocator(selector, this);

  mouse = {
    wheel: async (...args: any[]): Promise<void> => {
      this.calls.push({ method: 'mouse.wheel', args });
    },
    move: async (...args: any[]): Promise<void> => {
      this.calls.push({ method: 'mouse.move', args });
    },
    down: async (): Promise<void> => {
      this.calls.push({ method: 'mouse.down', args: [] });
    },
    up: async (): Promise<void> => {
      this.calls.push({ method: 'mouse.up', args: [] });
    },
  };

  keyboard = {
    press: async (key: string): Promise<void> => {
      this.calls.push({ method: 'keyboard.press', args: [key] });
    },
  };
}

/** 편의 팩토리 */
export function makeFakePage(options: FakePageOptions = {}): FakePage {
  return new FakePage(options);
}
