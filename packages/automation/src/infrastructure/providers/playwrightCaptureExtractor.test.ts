import { applyCaptureTransform, readCaptureSourceValue } from './playwrightCaptureExtractor';

describe('applyCaptureTransform', () => {
  it('returns raw when transform is undefined', () => {
    expect(applyCaptureTransform('hello', undefined)).toBe('hello');
  });

  it('extracts default group 1 by regex', () => {
    const out = applyCaptureTransform('photo-12345-abc.jpg', {
      type: 'regex',
      pattern: '(photo-\\d+)',
    });
    expect(out).toBe('photo-12345');
  });

  it('extracts explicit group index', () => {
    const out = applyCaptureTransform('id=42, name=foo', {
      type: 'regex',
      pattern: '(\\d+).*?(\\w+)$',
      group: 2,
    });
    expect(out).toBe('foo');
  });

  it('falls back to group 0 when group index is out of range', () => {
    const out = applyCaptureTransform('abc', {
      type: 'regex',
      pattern: 'abc',
      group: 5,
    });
    expect(out).toBe('abc');
  });

  it('throws when regex does not match', () => {
    expect(() =>
      applyCaptureTransform('hello world', { type: 'regex', pattern: '\\d{4}' }),
    ).toThrow(/regex 매치 실패/);
  });
});

describe('readCaptureSourceValue', () => {
  it('returns page.url() when fromUrl is set', async () => {
    const fakePage = { url: () => 'https://example.com/foo' } as any;
    const value = await readCaptureSourceValue(fakePage, { fromUrl: true });
    expect(value).toBe('https://example.com/foo');
  });

  it('throws when neither selector nor fromUrl is provided', async () => {
    const fakePage = { url: () => 'x' } as any;
    await expect(readCaptureSourceValue(fakePage, {})).rejects.toThrow(
      /selector 또는 fromUrl/,
    );
  });

  it('reads default attribute "src" via locator', async () => {
    const calls: { attr: string }[] = [];
    const fakeLocator = {
      waitFor: jest.fn().mockResolvedValue(undefined),
      getAttribute: jest.fn(async (attr: string) => {
        calls.push({ attr });
        return 'photo-9999';
      }),
    };
    const fakePage = {
      locator: jest.fn().mockReturnValue(fakeLocator),
    } as any;
    const value = await readCaptureSourceValue(fakePage, { selector: '#img' });
    expect(value).toBe('photo-9999');
    expect(calls).toEqual([{ attr: 'src' }]);
    expect(fakePage.locator).toHaveBeenCalledWith('#img');
  });

  it('reads custom attribute', async () => {
    const fakeLocator = {
      waitFor: jest.fn().mockResolvedValue(undefined),
      getAttribute: jest.fn().mockResolvedValue('alt-text'),
    };
    const fakePage = { locator: jest.fn().mockReturnValue(fakeLocator) } as any;
    const value = await readCaptureSourceValue(fakePage, {
      selector: '#img',
      attribute: 'alt',
    });
    expect(value).toBe('alt-text');
    expect(fakeLocator.getAttribute).toHaveBeenCalledWith('alt');
  });

  it('throws when attribute is null', async () => {
    const fakeLocator = {
      waitFor: jest.fn().mockResolvedValue(undefined),
      getAttribute: jest.fn().mockResolvedValue(null),
    };
    const fakePage = { locator: jest.fn().mockReturnValue(fakeLocator) } as any;
    await expect(
      readCaptureSourceValue(fakePage, { selector: '#missing' }),
    ).rejects.toThrow(/attribute 가 null/);
  });
});
