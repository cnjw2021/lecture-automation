import logUpdate = require('log-update');

export type SceneProgressStatus =
  | 'pending'
  | 'rendering'
  | 'downloading'
  | 'completed'
  | 'failed';

interface SceneProgressState {
  sceneId: number;
  status: SceneProgressStatus;
  percent: number;
  chunks: number;
  totalChunks: number | null;
  chunkStates: ('done' | 'rendering' | 'pending')[];
  elapsedSec: number | null;
  errorMessage: string | null;
}

export interface LambdaRenderProgressRendererOptions {
  barWidth?: number;
  stream?: NodeJS.WriteStream;
  isTTY?: boolean;
}

export interface ILambdaRenderProgressRenderer {
  begin(sceneIds: number[]): void;
  startScene(sceneId: number): void;
  noteRenderId(sceneId: number, renderId: string): void;
  updateProgress(
    sceneId: number,
    percent: number,
    chunks: number,
    totalChunks: number | null,
  ): void;
  downloadComplete(sceneId: number): void;
  completeScene(sceneId: number, elapsedSec: number): void;
  failScene(sceneId: number, message: string): void;
  done(): void;
}

export class LambdaRenderProgressRenderer implements ILambdaRenderProgressRenderer {
  private readonly barWidth: number;
  private readonly stream: NodeJS.WriteStream;
  private readonly isTTY: boolean;
  private readonly scenes = new Map<number, SceneProgressState>();
  private readonly orderedSceneIds: number[] = [];
  private readonly logUpdater: logUpdate.LogUpdate | null;
  private started = false;

  constructor(options: LambdaRenderProgressRendererOptions = {}) {
    this.barWidth = options.barWidth ?? 20;
    this.stream = options.stream ?? process.stdout;
    this.isTTY = options.isTTY ?? Boolean(this.stream.isTTY);
    this.logUpdater = this.isTTY ? logUpdate.create(this.stream) : null;
  }

  begin(sceneIds: number[]): void {
    this.started = true;
    for (const id of sceneIds) {
      if (!this.scenes.has(id)) {
        this.orderedSceneIds.push(id);
        this.scenes.set(id, this.createState(id));
      }
    }
    this.render();
  }

  startScene(sceneId: number): void {
    const state = this.ensureState(sceneId);
    state.status = 'rendering';
    this.render();
  }

  noteRenderId(sceneId: number, renderId: string): void {
    if (this.isTTY) {
      return;
    }
    this.writeLine(`      Scene ${sceneId} renderId=${renderId}`);
  }

  updateProgress(
    sceneId: number,
    percent: number,
    chunks: number,
    totalChunks: number | null,
  ): void {
    const state = this.ensureState(sceneId);
    if (state.status === 'completed' || state.status === 'failed') {
      return;
    }
    state.status = state.status === 'downloading' ? 'downloading' : 'rendering';
    state.percent = clamp(percent, 0, 100);
    state.chunks = chunks;
    state.totalChunks = totalChunks;
    if (totalChunks !== null) {
      state.chunkStates = Array.from({ length: totalChunks }, (_, i) =>
        i < chunks ? 'done' : 'rendering',
      );
    }
    this.render();
  }

  downloadComplete(sceneId: number): void {
    const state = this.ensureState(sceneId);
    state.status = 'downloading';
    state.percent = 100;
    this.render();
  }

  completeScene(sceneId: number, elapsedSec: number): void {
    const state = this.ensureState(sceneId);
    state.status = 'completed';
    state.percent = 100;
    state.elapsedSec = elapsedSec;
    if (state.totalChunks !== null && state.totalChunks > 0) {
      state.chunkStates = Array(state.totalChunks).fill('done');
    }
    this.render();
  }

  failScene(sceneId: number, message: string): void {
    const state = this.ensureState(sceneId);
    state.status = 'failed';
    state.errorMessage = message;
    this.render();
  }

  done(): void {
    if (!this.started) {
      return;
    }
    this.render();
    this.started = false;
    if (this.logUpdater) {
      this.logUpdater.done();
    }
    this.printTrailingErrors();
  }

  private printTrailingErrors(): void {
    const failed: SceneProgressState[] = [];
    for (const id of this.orderedSceneIds) {
      const state = this.scenes.get(id);
      if (state?.status === 'failed') {
        failed.push(state);
      }
    }
    if (failed.length === 0) {
      return;
    }
    this.writeLine('');
    for (const state of failed) {
      const message = state.errorMessage ?? 'unknown error';
      this.writeLine(`    ❌ Scene ${state.sceneId} 실패: ${message}`);
    }
  }

  private ensureState(sceneId: number): SceneProgressState {
    let state = this.scenes.get(sceneId);
    if (!state) {
      state = this.createState(sceneId);
      this.scenes.set(sceneId, state);
      this.orderedSceneIds.push(sceneId);
    }
    return state;
  }

  private createState(sceneId: number): SceneProgressState {
    return {
      sceneId,
      status: 'pending',
      percent: 0,
      chunks: 0,
      totalChunks: null,
      chunkStates: [],
      elapsedSec: null,
      errorMessage: null,
    };
  }

  private render(): void {
    if (!this.started) {
      return;
    }
    const maxSceneIdWidth = this.orderedSceneIds.reduce(
      (width, id) => Math.max(width, String(id).length),
      1,
    );
    const lines = this.orderedSceneIds.map(id => {
      const state = this.scenes.get(id)!;
      return this.formatLine(state, maxSceneIdWidth);
    });
    if (this.logUpdater) {
      this.logUpdater(lines.join('\n'));
    }
  }

  renderSnapshot(): string {
    const maxSceneIdWidth = this.orderedSceneIds.reduce(
      (width, id) => Math.max(width, String(id).length),
      1,
    );
    return this.orderedSceneIds
      .map(id => this.formatLine(this.scenes.get(id)!, maxSceneIdWidth))
      .join('\n');
  }

  private formatLine(state: SceneProgressState, sceneIdWidth: number): string {
    const sceneLabel = `Scene ${String(state.sceneId).padStart(sceneIdWidth, ' ')}`;
    const bar = this.renderBar(state.percent);
    const percentLabel = `${String(state.percent).padStart(3, ' ')}%`;
    const chunks = this.formatChunks(state);
    const status = this.formatStatus(state);
    const parts = [sceneLabel, bar, percentLabel];
    if (chunks.length > 0) {
      parts.push(chunks);
    }
    parts.push(status);
    const mainLine = parts.join('  ');

    const subLines = this.formatChunkSubLines(state);
    return subLines.length > 0 ? `${mainLine}\n${subLines.join('\n')}` : mainLine;
  }

  private formatChunkSubLines(state: SceneProgressState): string[] {
    const { chunkStates, totalChunks } = state;
    if (chunkStates.length === 0 || totalChunks === null || totalChunks <= 1) {
      return [];
    }
    const idWidth = String(totalChunks - 1).length;
    return chunkStates.map((chunkStatus, i) => {
      const label = `  Chunk ${String(i).padStart(idWidth, ' ')}`;
      const bar = chunkStatus === 'done' ? this.renderBar(100) : this.renderBar(0);
      const statusLabel = chunkStatus === 'done' ? '✅ 완료' : '렌더링 중';
      return `${label}  ${bar}  ${statusLabel}`;
    });
  }

  private renderBar(percent: number): string {
    const filled = Math.round((clamp(percent, 0, 100) / 100) * this.barWidth);
    const empty = this.barWidth - filled;
    return `[${'█'.repeat(filled)}${'░'.repeat(empty)}]`;
  }

  private formatChunks(state: SceneProgressState): string {
    if (state.totalChunks === null) {
      if (state.chunks === 0 && state.status === 'pending') {
        return '';
      }
      return `(chunks ${state.chunks})`;
    }
    return `(chunks ${state.chunks}/${state.totalChunks})`;
  }

  private formatStatus(state: SceneProgressState): string {
    switch (state.status) {
      case 'pending':
        return '대기 중';
      case 'rendering':
        return '렌더링 중';
      case 'downloading':
        return '다운로드 중';
      case 'completed': {
        const elapsed = state.elapsedSec === null ? '' : ` (${state.elapsedSec.toFixed(1)}초)`;
        return `✅ 완료${elapsed}`;
      }
      case 'failed':
        return '❌ 실패';
    }
  }

  private writeLine(line: string): void {
    this.stream.write(`${line}\n`);
  }
}

function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}
