import * as fs from 'fs-extra';
import { readWavMetadata, computeRmsFrames } from '../packages/automation/src/domain/utils/WavAnalysisUtils';

async function main() {
  const wavPath = 'tmp/chunked-audio/01-02/chunk-001.wav';
  const buf = await fs.readFile(wavPath);
  const meta = readWavMetadata(buf);
  const frames = computeRmsFrames(buf, meta);

  const rmsValues = frames.map(f => f.rms).sort((a, b) => a - b);
  const p = (q: number) => rmsValues[Math.floor(rmsValues.length * q)];
  console.log(`총 프레임: ${frames.length} (각 20ms)`);
  console.log(`RMS percentiles: p01=${p(0.01).toFixed(0)} p05=${p(0.05).toFixed(0)} p10=${p(0.10).toFixed(0)} p25=${p(0.25).toFixed(0)} p50=${p(0.50).toFixed(0)} p90=${p(0.90).toFixed(0)} p99=${p(0.99).toFixed(0)}`);

  // 문제 경계 9→10: 실제 leak 있던 곳. anchor=182.644s
  for (const [label, anchor] of [['B 2→3', 40468], ['B 9→10 leak', 182644], ['B 4→5 leak', 75937]] as const) {
    console.log(`\n--- ${label} anchor=${anchor}ms 주변 [-500ms, +2000ms] RMS ---`);
    const windowFrames = frames.filter(f => f.startMs >= anchor - 500 && f.endMs <= anchor + 2000);
    for (const f of windowFrames) {
      const bar = '▇'.repeat(Math.min(50, Math.floor(f.rms / 50)));
      const mark = f.startMs === anchor - (anchor % 20) ? ' ◀ anchor' : '';
      console.log(`  ${String(f.startMs).padStart(6)}ms rms=${String(Math.floor(f.rms)).padStart(5)} ${bar}${mark}`);
    }
  }
}
main();
