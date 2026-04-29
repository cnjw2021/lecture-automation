import { Page } from 'playwright';
import { CaptureTransform } from '../../domain/entities/Lecture';

/**
 * Playwright `right_click.captureFromTarget` / `capture` 액션이 페이지 상태(요소 attribute,
 * 현재 URL 등)를 추출하고 transform 을 적용해 캡처값으로 변환하는 책임을 담당.
 *
 * SSoT 목적:
 *   - playwrightStepExecutor (state-capture 모드)
 *   - PlaywrightVisualProvider (raw video 모드)
 * 두 경로 모두 같은 추출/변환 로직을 import 한다.
 *
 * SRP: 페이지 → string 변환만 담당한다. 디스크 영속성은 playwrightCaptureStore 가,
 *      후속 액션에서의 placeholder 치환은 expandActionPlaceholders 가 담당한다.
 */

const READ_ATTRIBUTE_TIMEOUT_MS = 10000;

export interface CaptureSourceOptions {
  selector?: string;
  attribute?: string;
  fromUrl?: boolean;
}

/**
 * raw 캡처값에 transform 을 적용해 최종 저장값을 만든다.
 * transform 이 없으면 raw 그대로 반환한다.
 *
 * @throws regex 매치에 실패하면 즉시 throw 한다 (silent fallback 금지).
 */
export function applyCaptureTransform(raw: string, transform: CaptureTransform | undefined): string {
  if (!transform) return raw;
  if (transform.type === 'regex') {
    const re = new RegExp(transform.pattern);
    const m = raw.match(re);
    if (!m) {
      throw new Error(
        `capture transform regex 매치 실패: pattern=${transform.pattern}, raw=${raw.slice(0, 200)}`,
      );
    }
    const group = transform.group ?? 1;
    return m[group] ?? m[0];
  }
  return raw;
}

/**
 * 페이지에서 캡처 원본값을 읽는다.
 *   - fromUrl: 현재 페이지 URL
 *   - selector + attribute: 해당 요소의 attribute 값 (기본 'src')
 * 둘 다 없으면 즉시 throw.
 */
export async function readCaptureSourceValue(
  page: Page,
  options: CaptureSourceOptions,
): Promise<string> {
  if (options.fromUrl) {
    return page.url();
  }
  if (!options.selector) {
    throw new Error('capture: selector 또는 fromUrl 중 하나가 필요합니다');
  }
  const attr = options.attribute ?? 'src';
  const loc = page.locator(options.selector);
  await loc.waitFor({ state: 'attached', timeout: READ_ATTRIBUTE_TIMEOUT_MS });
  const value = await loc.getAttribute(attr);
  if (value === null) {
    throw new Error(
      `capture: selector ${options.selector} 의 ${attr} attribute 가 null 입니다`,
    );
  }
  return value;
}
