import { assembleSceneAudio } from './WavChunkAssembler';
import { AudioConfig, AudioAlignment } from '../interfaces/IAudioProvider';

const audioConfig: AudioConfig = {
  sampleRate: 24000,
  channels: 1,
  bitDepth: 16,
  speechRate: 1,
};

/** 간단한 PCM WAV 버퍼 생성 (44B 헤더 + zero-filled PCM). */
function makeWav(durationSec: number, cfg = audioConfig): Buffer {
  const bytesPerFrame = cfg.channels * (cfg.bitDepth / 8);
  const totalFrames = Math.floor(durationSec * cfg.sampleRate);
  const dataSize = totalFrames * bytesPerFrame;

  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(cfg.channels, 22);
  header.writeUInt32LE(cfg.sampleRate, 24);
  header.writeUInt32LE(cfg.sampleRate * bytesPerFrame, 28);
  header.writeUInt16LE(bytesPerFrame, 32);
  header.writeUInt16LE(cfg.bitDepth, 34);
  header.write('data', 36);
  header.writeUInt32LE(dataSize, 40);

  return Buffer.concat([header, Buffer.alloc(dataSize, 0)]);
}

describe('assembleSceneAudio', () => {
  it('단일 청크 입력을 그대로 반환한다', () => {
    const result = assembleSceneAudio([{ buffer: makeWav(1.0) }], audioConfig);
    expect(result.durationSec).toBeCloseTo(1.0, 2);
    expect(result.buffer.length).toBe(44 + 24000 * 2);
  });

  it('두 청크 concat 시 duration 이 합산된다', () => {
    const result = assembleSceneAudio(
      [{ buffer: makeWav(0.5) }, { buffer: makeWav(1.0) }],
      audioConfig,
    );
    expect(result.durationSec).toBeCloseTo(1.5, 2);
  });

  it('alignment 는 청크 누적 duration 으로 offset 되어 병합된다', () => {
    const align1: AudioAlignment = {
      characters: ['あ', 'い'],
      character_start_times_seconds: [0.0, 0.1],
      character_end_times_seconds: [0.1, 0.2],
    };
    const align2: AudioAlignment = {
      characters: ['う', 'え'],
      character_start_times_seconds: [0.0, 0.15],
      character_end_times_seconds: [0.15, 0.3],
    };

    const result = assembleSceneAudio(
      [
        { buffer: makeWav(0.5), alignment: align1 },
        { buffer: makeWav(0.6), alignment: align2 },
      ],
      audioConfig,
    );

    expect(result.alignment).toBeDefined();
    expect(result.alignment!.characters).toEqual(['あ', 'い', 'う', 'え']);
    // 두 번째 청크는 0.5s 오프셋
    expect(result.alignment!.character_start_times_seconds).toEqual([0.0, 0.1, 0.5, 0.65]);
    expect(result.alignment!.character_end_times_seconds).toEqual([0.1, 0.2, 0.65, 0.8]);
  });

  it('alignment 가 하나라도 빠지면 전체 alignment 는 undefined', () => {
    const align1: AudioAlignment = {
      characters: ['あ'],
      character_start_times_seconds: [0],
      character_end_times_seconds: [0.1],
    };
    const result = assembleSceneAudio(
      [
        { buffer: makeWav(0.5), alignment: align1 },
        { buffer: makeWav(0.5) }, // alignment 누락
      ],
      audioConfig,
    );
    expect(result.alignment).toBeUndefined();
  });

  it('빈 입력은 에러', () => {
    expect(() => assembleSceneAudio([], audioConfig)).toThrow();
  });

  it('헤더보다 짧은 버퍼는 에러', () => {
    const badBuffer = Buffer.alloc(20);
    expect(() => assembleSceneAudio([{ buffer: badBuffer }], audioConfig)).toThrow();
  });
});
