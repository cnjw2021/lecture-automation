export interface WavMetadata {
  sampleRate: number;
  channels: number;
  bitDepth: number;
  dataOffset: number;
  dataSize: number;
  durationSec: number;
}

export interface RmsFrame {
  startMs: number;
  endMs: number;
  rms: number;
}

function findChunk(buffer: Buffer, chunkId: string, startOffset = 12): { offset: number; size: number } | null {
  for (let offset = startOffset; offset + 8 <= buffer.length; ) {
    const id = buffer.toString('ascii', offset, offset + 4);
    const size = buffer.readUInt32LE(offset + 4);
    if (id === chunkId) {
      return { offset, size };
    }
    offset += 8 + size + (size % 2);
  }
  return null;
}

export function readWavMetadata(buffer: Buffer): WavMetadata {
  if (buffer.length < 44 || buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WAVE') {
    throw new Error('지원하지 않는 WAV 파일입니다. PCM WAV로 정규화해 주세요.');
  }

  const fmtChunk = findChunk(buffer, 'fmt ');
  const dataChunk = findChunk(buffer, 'data');
  if (!fmtChunk || !dataChunk) {
    throw new Error('WAV 필수 청크(fmt/data)를 찾을 수 없습니다.');
  }

  const audioFormat = buffer.readUInt16LE(fmtChunk.offset + 8);
  if (audioFormat !== 1) {
    throw new Error(`PCM WAV만 지원합니다. audioFormat=${audioFormat}`);
  }

  const channels = buffer.readUInt16LE(fmtChunk.offset + 10);
  const sampleRate = buffer.readUInt32LE(fmtChunk.offset + 12);
  const bitDepth = buffer.readUInt16LE(fmtChunk.offset + 22);
  const dataOffset = dataChunk.offset + 8;
  const dataSize = dataChunk.size;
  const bytesPerSecond = sampleRate * channels * (bitDepth / 8);
  const durationSec = dataSize / bytesPerSecond;

  return {
    sampleRate,
    channels,
    bitDepth,
    dataOffset,
    dataSize,
    durationSec,
  };
}

export function computeRmsFrames(buffer: Buffer, metadata: WavMetadata, windowMs = 20): RmsFrame[] {
  if (metadata.bitDepth !== 16) {
    throw new Error(`16-bit PCM WAV만 RMS 계산을 지원합니다. bitDepth=${metadata.bitDepth}`);
  }

  const pcm = buffer.subarray(metadata.dataOffset, metadata.dataOffset + metadata.dataSize);
  const bytesPerSample = metadata.bitDepth / 8;
  const frameSamples = Math.max(1, Math.floor((metadata.sampleRate * windowMs) / 1000));
  const frameBytes = frameSamples * metadata.channels * bytesPerSample;
  const frames: RmsFrame[] = [];

  for (let offset = 0; offset < pcm.length; offset += frameBytes) {
    let sumSq = 0;
    let sampleCount = 0;
    const endOffset = Math.min(offset + frameBytes, pcm.length);

    for (let cursor = offset; cursor + 1 < endOffset; cursor += bytesPerSample * metadata.channels) {
      const sample = pcm.readInt16LE(cursor);
      sumSq += sample * sample;
      sampleCount += 1;
    }

    const startMs = Math.round((offset / (metadata.sampleRate * metadata.channels * bytesPerSample)) * 1000);
    const endMs = Math.round((endOffset / (metadata.sampleRate * metadata.channels * bytesPerSample)) * 1000);
    frames.push({
      startMs,
      endMs,
      rms: sampleCount > 0 ? Math.sqrt(sumSq / sampleCount) : 0,
    });
  }

  return frames;
}
