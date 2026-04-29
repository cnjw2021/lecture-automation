import {
  normalizeContextMenuItems,
  injectContextMenu,
  removeContextMenu,
} from './playwrightContextMenu';

describe('normalizeContextMenuItems', () => {
  it('passes through string items and marks click target as highlighted', () => {
    const items = ['コピー', '画像をコピー', '保存'];
    const out = normalizeContextMenuItems(items, '画像をコピー');
    expect(out).toEqual([
      { label: 'コピー', highlighted: false, separator: false },
      { label: '画像をコピー', highlighted: true, separator: false },
      { label: '保存', highlighted: false, separator: false },
    ]);
  });

  it('handles object items with explicit highlighted flag', () => {
    const out = normalizeContextMenuItems(
      [{ label: 'A', highlighted: true }, { label: 'B' }],
      undefined,
    );
    expect(out[0]).toEqual({ label: 'A', highlighted: true, separator: false });
    expect(out[1]).toEqual({ label: 'B', highlighted: false, separator: false });
  });

  it('renders separators with empty label', () => {
    const out = normalizeContextMenuItems([{ separator: true }, 'ヘルプ'], undefined);
    expect(out[0]).toEqual({ label: '', highlighted: false, separator: true });
    expect(out[1]).toEqual({ label: 'ヘルプ', highlighted: false, separator: false });
  });

  it('combines explicit highlight and click target', () => {
    const out = normalizeContextMenuItems(
      [{ label: 'X', highlighted: true }, { label: 'Y' }],
      'Y',
    );
    expect(out[0].highlighted).toBe(true);
    expect(out[1].highlighted).toBe(true);
  });
});

describe('injectContextMenu / removeContextMenu', () => {
  it('passes the same elementId to both inject and remove evaluations', async () => {
    const evaluateCalls: any[] = [];
    const fakePage = {
      evaluate: jest.fn(async (_fn: any, arg: any) => {
        evaluateCalls.push(arg);
      }),
    } as any;

    const items = normalizeContextMenuItems(['コピー'], 'コピー');
    await injectContextMenu(fakePage, { x: 10, y: 20 }, items);
    await removeContextMenu(fakePage);

    expect(evaluateCalls).toHaveLength(2);
    expect(evaluateCalls[0].elementId).toBe('__playwright_context_menu__');
    expect(evaluateCalls[0].position).toEqual({ x: 10, y: 20 });
    expect(evaluateCalls[0].renderItems[0].label).toBe('コピー');
    expect(evaluateCalls[1]).toBe('__playwright_context_menu__');
  });
});
