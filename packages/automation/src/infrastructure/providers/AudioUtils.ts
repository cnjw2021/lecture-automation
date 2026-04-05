import { AudioConfig } from '../../domain/interfaces/IAudioProvider';

const FADE_IN_MS = 15;

/**
 * PCM 앞부분에 페이드인을 적용하여 재생 시작 시 '틱' 소리를 제거합니다.
 * LINEAR16 (16-bit signed, little-endian) 포맷 전용.
 */
function applyFadeIn(pcmData: Buffer, sampleRate: number, channels: number): Buffer {
  const fadeSamples = Math.round((FADE_IN_MS / 1000) * sampleRate * channels);
  const result = Buffer.from(pcmData);
  for (let i = 0; i < fadeSamples && i * 2 + 1 < result.length; i++) {
    const sample = result.readInt16LE(i * 2);
    result.writeInt16LE(Math.round(sample * (i / fadeSamples)), i * 2);
  }
  return result;
}

export function pcmToWav(pcmData: Buffer, audioConfig: AudioConfig): { buffer: Buffer; durationSec: number } {
  const { sampleRate, channels, bitDepth } = audioConfig;
  const sampleWidth = bitDepth / 8;

  const fadedPcm = applyFadeIn(pcmData, sampleRate, channels);
  const dataSize = fadedPcm.length;

  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * channels * sampleWidth, 28);
  header.writeUInt16LE(channels * sampleWidth, 32);
  header.writeUInt16LE(sampleWidth * 8, 34);
  header.write('data', 36);
  header.writeUInt32LE(dataSize, 40);

  const buffer = Buffer.concat([header, fadedPcm]);
  const durationSec = dataSize / (sampleRate * channels * sampleWidth);
  return { buffer, durationSec };
}
