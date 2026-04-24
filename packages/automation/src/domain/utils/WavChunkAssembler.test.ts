import {
  assembleSceneAudio,
  AssembleSceneAudioOptions,
  DEFAULT_CROSSFADE_MS,
} from './WavChunkAssembler';
import { AudioConfig, AudioAlignment } from '../interfaces/IAudioProvider';

const audioConfig: AudioConfig = {
  sampleRate: 24000,
  channels: 1,
  bitDepth: 16,
  speechRate: 1,
};

/** 옵션 off — 단순 concat 계약 검증용. */
const RAW_OPTIONS: AssembleSceneAudioOptions = { crossfadeMs: 0, trimSilence: false };

/** 지정 amplitude 로 채워진 PCM WAV 버퍼 생성 (44B 헤더 + int16 PCM). */
function makeWav(durationSec: number, amplitude = 0, cfg = audioConfig): Buffer {
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

  const pcm = Buffer.alloc(dataSize, 0);
  if (amplitude !== 0) {
    for (let f = 0; f < totalFrames; f++) {
      for (let c = 0; c < cfg.channels; c++) {
        pcm.writeInt16LE(amplitude, f * bytesPerFrame + c * 2);
      }
    }
  }
  return Buffer.concat([header, pcm]);
}

/**
 * head 무음 + loud 구간 + tail 무음으로 구성된 WAV 생성.
 * amplitude 는 loud 구간의 int16 값.
 */
function makeWavWithSilence(
  headSilenceSec: number,
  loudSec: number,
  tailSilenceSec: number,
  amplitude: number,
  cfg = audioConfig,
): Buffer {
  const bytesPerFrame = cfg.channels * (cfg.bitDepth / 8);
  const headFrames = Math.floor(headSilenceSec * cfg.sampleRate);
  const loudFrames = Math.floor(loudSec * cfg.sampleRate);
  const tailFrames = Math.floor(tailSilenceSec * cfg.sampleRate);
  const totalFrames = headFrames + loudFrames + tailFrames;
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

  const pcm = Buffer.alloc(dataSize, 0);
  for (let f = headFrames; f < headFrames + loudFrames; f++) {
    for (let c = 0; c < cfg.channels; c++) {
      pcm.writeInt16LE(amplitude, f * bytesPerFrame + c * 2);
    }
  }
  return Buffer.concat([header, pcm]);
}

describe('assembleSceneAudio — 옵션 off (단순 concat 계약)', () => {
  it('단일 청크 입력을 그대로 반환한다', () => {
    const result = assembleSceneAudio([{ buffer: makeWav(1.0) }], audioConfig, RAW_OPTIONS);
    expect(result.durationSec).toBeCloseTo(1.0, 2);
    expect(result.buffer.length).toBe(44 + 24000 * 2);
  });

  it('두 청크 concat 시 duration 이 합산된다', () => {
    const result = assembleSceneAudio(
      [{ buffer: makeWav(0.5) }, { buffer: makeWav(1.0) }],
      audioConfig,
      RAW_OPTIONS,
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
      RAW_OPTIONS,
    );

    expect(result.alignment).toBeDefined();
    expect(result.alignment!.characters).toEqual(['あ', 'い', 'う', 'え']);
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
        { buffer: makeWav(0.5) },
      ],
      audioConfig,
      RAW_OPTIONS,
    );
    expect(result.alignment).toBeUndefined();
  });

  it('빈 입력은 에러', () => {
    expect(() => assembleSceneAudio([], audioConfig, RAW_OPTIONS)).toThrow();
  });

  it('헤더보다 짧은 버퍼는 에러', () => {
    const badBuffer = Buffer.alloc(20);
    expect(() => assembleSceneAudio([{ buffer: badBuffer }], audioConfig, RAW_OPTIONS)).toThrow();
  });
});

describe('assembleSceneAudio — 무음 trim', () => {
  it('청크 head/tail 의 무음을 제거한다', () => {
    const chunk = makeWavWithSilence(0.1, 0.3, 0.2, 8000); // 0.6s 총 길이, loud 0.3s
    const result = assembleSceneAudio([{ buffer: chunk }], audioConfig, {
      crossfadeMs: 0,
      trimSilence: true,
    });
    expect(result.durationSec).toBeCloseTo(0.3, 2);
  });

  it('전부 무음인 청크는 trim 하지 않고 그대로 유지한다', () => {
    const chunk = makeWav(0.5, 0); // 0-filled
    const result = assembleSceneAudio([{ buffer: chunk }], audioConfig, {
      crossfadeMs: 0,
      trimSilence: true,
    });
    expect(result.durationSec).toBeCloseTo(0.5, 2);
  });

  it('임계값 이하 샘플은 무음으로 간주된다', () => {
    const chunk = makeWavWithSilence(0.1, 0.3, 0.2, 300); // amplitude 300 < 기본 임계 512
    const result = assembleSceneAudio([{ buffer: chunk }], audioConfig, {
      crossfadeMs: 0,
      trimSilence: true,
    });
    // 전부 무음으로 간주 → trim 스킵 → 원본 길이 유지
    expect(result.durationSec).toBeCloseTo(0.6, 2);
  });

  it('alignment 는 head trim 만큼 앞으로 당겨진다', () => {
    const chunk = makeWavWithSilence(0.1, 0.3, 0.2, 8000);
    const align: AudioAlignment = {
      characters: ['あ'],
      character_start_times_seconds: [0.15], // head silence 구간 바로 뒤
      character_end_times_seconds: [0.25],
    };
    const result = assembleSceneAudio([{ buffer: chunk, alignment: align }], audioConfig, {
      crossfadeMs: 0,
      trimSilence: true,
    });
    expect(result.alignment!.character_start_times_seconds[0]).toBeCloseTo(0.05, 2);
    expect(result.alignment!.character_end_times_seconds[0]).toBeCloseTo(0.15, 2);
  });
});

describe('assembleSceneAudio — 경계 crossfade', () => {
  it('경계 하나당 crossfade 길이만큼 총 duration 이 짧아진다', () => {
    const chunkA = makeWav(0.5, 8000);
    const chunkB = makeWav(0.5, 8000);
    const result = assembleSceneAudio([{ buffer: chunkA }, { buffer: chunkB }], audioConfig, {
      crossfadeMs: 30,
      trimSilence: false,
    });
    const expected = 1.0 - 30 / 1000;
    expect(result.durationSec).toBeCloseTo(expected, 3);
  });

  it('crossfade 구간 중앙 샘플은 양쪽 청크 값의 평균 근사', () => {
    const ampA = 8000;
    const ampB = -4000;
    const chunkA = makeWav(0.5, ampA);
    const chunkB = makeWav(0.5, ampB);
    const result = assembleSceneAudio([{ buffer: chunkA }, { buffer: chunkB }], audioConfig, {
      crossfadeMs: 30,
      trimSilence: false,
    });

    const cfFrames = Math.floor((30 / 1000) * audioConfig.sampleRate);
    const chunkAFrames = Math.floor(0.5 * audioConfig.sampleRate);
    // crossfade 중앙 프레임 = chunk A 의 마지막 cfFrames/2 프레임 = 씬 전체 기준 (chunkAFrames - cfFrames/2) 근처
    const centerFrame = chunkAFrames - Math.floor(cfFrames / 2);
    const pcm = result.buffer.subarray(44);
    const centerSample = pcm.readInt16LE(centerFrame * 2);
    const avg = (ampA + ampB) / 2;
    // 선형 crossfade 이므로 중앙에서 약 50:50 혼합. ±50 단위 오차 허용 (정수 반올림 + 양 끝 1/N 보정 영향).
    expect(Math.abs(centerSample - avg)).toBeLessThan(400);
  });

  it('crossfade + trim 적용 시 alignment 는 trim + crossfade 반영해 offset 된다', () => {
    // chunk A: head 0.1 + loud 0.3 + tail 0.2 = 총 0.6s → trim 후 0.3s
    // chunk B: head 0.05 + loud 0.4 + tail 0.15 = 총 0.6s → trim 후 0.4s
    const chunkA = makeWavWithSilence(0.1, 0.3, 0.2, 8000);
    const chunkB = makeWavWithSilence(0.05, 0.4, 0.15, 8000);
    const alignA: AudioAlignment = {
      characters: ['あ'],
      character_start_times_seconds: [0.15],
      character_end_times_seconds: [0.25],
    };
    const alignB: AudioAlignment = {
      characters: ['い'],
      character_start_times_seconds: [0.1],
      character_end_times_seconds: [0.3],
    };

    const result = assembleSceneAudio(
      [
        { buffer: chunkA, alignment: alignA },
        { buffer: chunkB, alignment: alignB },
      ],
      audioConfig,
      { crossfadeMs: 30, trimSilence: true },
    );

    // trim 후 총 길이 = 0.3 + 0.4 - 0.03 = 0.67
    expect(result.durationSec).toBeCloseTo(0.67, 2);

    // chunk A 의 'あ' : 원래 0.15 - head trim 0.1 = 0.05
    expect(result.alignment!.character_start_times_seconds[0]).toBeCloseTo(0.05, 2);
    // chunk B 의 'い' : 원래 0.1 - head trim 0.05 + chunkB 시작 offset (0.3 - 0.03 = 0.27)
    // = 0.1 - 0.05 + 0.27 = 0.32
    expect(result.alignment!.character_start_times_seconds[1]).toBeCloseTo(0.32, 2);
  });

  it('기본 옵션은 crossfade 30ms + trim on', () => {
    const chunkA = makeWav(0.5, 8000);
    const chunkB = makeWav(0.5, 8000);
    const result = assembleSceneAudio([{ buffer: chunkA }, { buffer: chunkB }], audioConfig);
    const expected = 1.0 - DEFAULT_CROSSFADE_MS / 1000;
    expect(result.durationSec).toBeCloseTo(expected, 3);
  });

  it('청크가 매우 짧아도 crossfade 가 청크 절반을 넘지 않게 제한된다', () => {
    // 10ms 청크 × 2, crossfade 30ms 요청 → 실제 cf = 5ms (절반)
    const tinyChunk = makeWav(0.01, 8000);
    const result = assembleSceneAudio(
      [{ buffer: tinyChunk }, { buffer: tinyChunk }],
      audioConfig,
      { crossfadeMs: 30, trimSilence: false },
    );
    // 10ms * 2 - 5ms = 15ms
    expect(result.durationSec).toBeCloseTo(0.015, 3);
  });
});
