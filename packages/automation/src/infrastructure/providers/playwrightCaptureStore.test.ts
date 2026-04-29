import * as fs from 'fs-extra';
import * as os from 'os';
import * as path from 'path';
import {
  saveCapture,
  loadCapture,
  expandCapturePlaceholders,
  hasCapturePlaceholder,
  extractCaptureKeys,
  loadAllCapturesForLecture,
  expandWithMap,
} from './playwrightCaptureStore';

describe('playwrightCaptureStore', () => {
  let tmpRoot: string;

  beforeEach(async () => {
    tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'pw-capture-store-'));
  });

  afterEach(async () => {
    if (tmpRoot) await fs.remove(tmpRoot);
  });

  it('saves and loads a capture', async () => {
    await saveCapture('lec-01', 'photo_id', 'photo-12345-abc', { sceneId: 30 }, { projectRoot: tmpRoot });
    const loaded = await loadCapture('lec-01', 'photo_id', { projectRoot: tmpRoot });
    expect(loaded).toBe('photo-12345-abc');
  });

  it('returns null for missing key', async () => {
    const loaded = await loadCapture('lec-01', 'nonexistent', { projectRoot: tmpRoot });
    expect(loaded).toBeNull();
  });

  it('expands ${capture:key} from saved value', async () => {
    await saveCapture('lec-01', 'photo_id', 'photo-12345-abc', {}, { projectRoot: tmpRoot });
    const expanded = await expandCapturePlaceholders(
      'lec-01',
      'src="${capture:photo_id}?w=600"',
      { projectRoot: tmpRoot },
    );
    expect(expanded).toBe('src="photo-12345-abc?w=600"');
  });

  it('throws on missing key in strict mode', async () => {
    await expect(
      expandCapturePlaceholders(
        'lec-01',
        'src="${capture:missing}"',
        { projectRoot: tmpRoot },
      ),
    ).rejects.toThrow(/캡처값 없음/);
  });

  it('falls back to dummy in mock-only mode', async () => {
    const expanded = await expandCapturePlaceholders(
      'lec-01',
      'src="${capture:missing}"',
      { projectRoot: tmpRoot, missingMode: 'mock-only' },
    );
    expect(expanded).toBe('src="__capture_missing__"');
  });

  it('reads .mock.json fallback', async () => {
    const dir = path.join(tmpRoot, 'tmp', 'playwright-captures', 'lec-01');
    await fs.ensureDir(dir);
    await fs.writeJson(path.join(dir, '.mock.json'), { mock_only_key: 'mocked-value' });
    const expanded = await expandCapturePlaceholders(
      'lec-01',
      'x=${capture:mock_only_key}',
      { projectRoot: tmpRoot },
    );
    expect(expanded).toBe('x=mocked-value');
  });

  it('hasCapturePlaceholder + extractCaptureKeys', () => {
    expect(hasCapturePlaceholder(undefined)).toBe(false);
    expect(hasCapturePlaceholder('plain text')).toBe(false);
    expect(hasCapturePlaceholder('use ${capture:k1}')).toBe(true);
    expect(extractCaptureKeys('${capture:k1} and ${capture:k2}')).toEqual(['k1', 'k2']);
  });

  it('loadAllCapturesForLecture merges mock + actual captures', async () => {
    const dir = path.join(tmpRoot, 'tmp', 'playwright-captures', 'lec-01');
    await fs.ensureDir(dir);
    await fs.writeJson(path.join(dir, '.mock.json'), { foo: 'mock-foo', bar: 'mock-bar' });
    await saveCapture('lec-01', 'foo', 'real-foo', {}, { projectRoot: tmpRoot });
    const all = await loadAllCapturesForLecture('lec-01', { projectRoot: tmpRoot });
    expect(all).toEqual({ foo: 'real-foo', bar: 'mock-bar' });
  });

  it('expandWithMap is sync and uses the provided map', () => {
    const map = { photo_id: 'photo-1234-abc' };
    expect(expandWithMap('src="${capture:photo_id}"', map)).toBe('src="photo-1234-abc"');
    expect(expandWithMap('src="${capture:missing}"', map)).toBe('src="${capture:missing}"');
    expect(
      expandWithMap('src="${capture:missing}"', map, (k) => `[${k}]`),
    ).toBe('src="[missing]"');
  });
});
