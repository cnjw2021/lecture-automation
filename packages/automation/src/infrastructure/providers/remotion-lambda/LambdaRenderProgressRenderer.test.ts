import { LambdaRenderProgressRenderer } from './LambdaRenderProgressRenderer';

function createFakeStream(): NodeJS.WriteStream & { output: string } {
  const chunks: string[] = [];
  const stream = {
    write(chunk: string | Uint8Array): boolean {
      chunks.push(typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString());
      return true;
    },
    get output(): string {
      return chunks.join('');
    },
    isTTY: false,
  } as unknown as NodeJS.WriteStream & { output: string };
  return stream;
}

describe('LambdaRenderProgressRenderer', () => {
  it('formats a rendering line with scene label, bar, percent, chunks and status', () => {
    const renderer = new LambdaRenderProgressRenderer({ barWidth: 10, isTTY: false });
    renderer.begin([2]);
    renderer.startScene(2);
    renderer.updateProgress(2, 60, 3, 5);

    const lines = renderer.renderSnapshot().split('\n');

    expect(lines[0]).toBe('Scene 2  [██████░░░░]   60%  (chunks 3/5)  렌더링 중');
    expect(lines[1]).toBe('  Chunk 0  [██████████]  ✅ 완료');
    expect(lines[2]).toBe('  Chunk 1  [██████████]  ✅ 완료');
    expect(lines[3]).toBe('  Chunk 2  [██████████]  ✅ 완료');
    expect(lines[4]).toBe('  Chunk 3  [░░░░░░░░░░]  렌더링 중');
    expect(lines[5]).toBe('  Chunk 4  [░░░░░░░░░░]  렌더링 중');
  });

  it('right-pads scene ids based on the widest scene id in the session', () => {
    const renderer = new LambdaRenderProgressRenderer({ barWidth: 4, isTTY: false });
    renderer.begin([2, 21]);

    const snapshot = renderer.renderSnapshot();

    const lines = snapshot.split('\n');
    expect(lines[0].startsWith('Scene  2  ')).toBe(true);
    expect(lines[1].startsWith('Scene 21  ')).toBe(true);
  });

  it('caps percent to 0..100 and renders a full bar at 100%', () => {
    const renderer = new LambdaRenderProgressRenderer({ barWidth: 5, isTTY: false });
    renderer.begin([1]);
    renderer.startScene(1);
    renderer.updateProgress(1, 150, 1, 1);

    expect(renderer.renderSnapshot()).toContain('[█████]');
    expect(renderer.renderSnapshot()).toContain('100%');
  });

  it('marks a scene completed with elapsed seconds', () => {
    const renderer = new LambdaRenderProgressRenderer({ barWidth: 4, isTTY: false });
    renderer.begin([10]);
    renderer.completeScene(10, 126);

    const snapshot = renderer.renderSnapshot();

    expect(snapshot).toContain('✅ 완료 (126.0초)');
    expect(snapshot).toContain('100%');
  });

  it('marks a scene failed and prints the error after done() in non-TTY mode', () => {
    const stream = createFakeStream();
    const renderer = new LambdaRenderProgressRenderer({
      barWidth: 4,
      isTTY: false,
      stream,
    });
    renderer.begin([7]);
    renderer.startScene(7);
    renderer.failScene(7, 'Lambda timeout');

    expect(renderer.renderSnapshot()).toContain('❌ 실패');

    renderer.done();

    expect(stream.output).toContain('❌ Scene 7 실패: Lambda timeout');
  });

  it('does not render through log-update in non-TTY mode', () => {
    const stream = createFakeStream();
    const renderer = new LambdaRenderProgressRenderer({
      barWidth: 4,
      isTTY: false,
      stream,
    });
    renderer.begin([1]);
    renderer.startScene(1);
    renderer.updateProgress(1, 50, 1, 2);
    renderer.completeScene(1, 10);
    renderer.done();

    expect(stream.output).not.toContain('Scene 1  [');
  });

  it('prints renderId line only in non-TTY mode to avoid breaking sticky output', () => {
    const stream = createFakeStream();
    const ttyRenderer = new LambdaRenderProgressRenderer({
      barWidth: 4,
      isTTY: true,
      stream,
    });
    ttyRenderer.begin([3]);
    ttyRenderer.noteRenderId(3, 'abc123');

    expect(stream.output).not.toContain('abc123');

    const plainStream = createFakeStream();
    const nonTtyRenderer = new LambdaRenderProgressRenderer({
      barWidth: 4,
      isTTY: false,
      stream: plainStream,
    });
    nonTtyRenderer.begin([3]);
    nonTtyRenderer.noteRenderId(3, 'abc123');

    expect(plainStream.output).toContain('Scene 3 renderId=abc123');
  });

  it('keeps completed scenes stable against later progress updates', () => {
    const renderer = new LambdaRenderProgressRenderer({ barWidth: 4, isTTY: false });
    renderer.begin([5]);
    renderer.completeScene(5, 42);
    renderer.updateProgress(5, 20, 0, 1);

    expect(renderer.renderSnapshot()).toContain('✅ 완료 (42.0초)');
    expect(renderer.renderSnapshot()).not.toContain('20%');
  });

  it('auto-registers scenes that were not passed to begin()', () => {
    const renderer = new LambdaRenderProgressRenderer({ barWidth: 4, isTTY: false });
    renderer.begin([]);
    renderer.startScene(9);
    renderer.updateProgress(9, 10, 0, 1);

    expect(renderer.renderSnapshot()).toContain('Scene 9');
  });

  it('omits chunk sub-lines when totalChunks is 1', () => {
    const renderer = new LambdaRenderProgressRenderer({ barWidth: 20, isTTY: false });
    renderer.begin([1]);
    renderer.startScene(1);
    renderer.updateProgress(1, 50, 0, 1);

    const snapshot = renderer.renderSnapshot();

    expect(snapshot.split('\n').length).toBe(1);
    expect(snapshot).not.toContain('Chunk');
  });

  it('omits chunk sub-lines when totalChunks is null', () => {
    const renderer = new LambdaRenderProgressRenderer({ barWidth: 20, isTTY: false });
    renderer.begin([1]);
    renderer.startScene(1);
    renderer.updateProgress(1, 10, 0, null);

    const snapshot = renderer.renderSnapshot();

    expect(snapshot.split('\n').length).toBe(1);
    expect(snapshot).not.toContain('Chunk');
  });

  it('shows chunk sub-lines matching issue target output', () => {
    const renderer = new LambdaRenderProgressRenderer({ barWidth: 20, isTTY: false });
    renderer.begin([16]);
    renderer.startScene(16);
    renderer.updateProgress(16, 60, 2, 5);

    const lines = renderer.renderSnapshot().split('\n');

    expect(lines[0]).toContain('(chunks 2/5)');
    expect(lines[1]).toBe('  Chunk 0  [████████████████████]  ✅ 완료');
    expect(lines[2]).toBe('  Chunk 1  [████████████████████]  ✅ 완료');
    expect(lines[3]).toBe('  Chunk 2  [░░░░░░░░░░░░░░░░░░░░]  렌더링 중');
    expect(lines[4]).toBe('  Chunk 3  [░░░░░░░░░░░░░░░░░░░░]  렌더링 중');
    expect(lines[5]).toBe('  Chunk 4  [░░░░░░░░░░░░░░░░░░░░]  렌더링 중');
  });

  it('marks all chunks as done after completeScene', () => {
    const renderer = new LambdaRenderProgressRenderer({ barWidth: 10, isTTY: false });
    renderer.begin([3]);
    renderer.startScene(3);
    renderer.updateProgress(3, 80, 2, 3);
    renderer.completeScene(3, 55);

    const lines = renderer.renderSnapshot().split('\n');

    expect(lines[0]).toContain('✅ 완료 (55.0초)');
    expect(lines[1]).toBe('  Chunk 0  [██████████]  ✅ 완료');
    expect(lines[2]).toBe('  Chunk 1  [██████████]  ✅ 완료');
    expect(lines[3]).toBe('  Chunk 2  [██████████]  ✅ 완료');
  });

  it('pads chunk ids when totalChunks exceeds 10', () => {
    const renderer = new LambdaRenderProgressRenderer({ barWidth: 4, isTTY: false });
    renderer.begin([1]);
    renderer.startScene(1);
    renderer.updateProgress(1, 10, 1, 12);

    const lines = renderer.renderSnapshot().split('\n');

    expect(lines[1]).toContain('Chunk  0');
    expect(lines[2]).toContain('Chunk  1');
    expect(lines[10]).toContain('Chunk  9');
    expect(lines[11]).toContain('Chunk 10');
  });
});
