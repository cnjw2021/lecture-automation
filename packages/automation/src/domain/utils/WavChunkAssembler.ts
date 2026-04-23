import { AudioAlignment, AudioConfig } from '../interfaces/IAudioProvider';

/**
 * 여러 청크 WAV 버퍼를 하나로 병합하고, 각 청크의 alignment 를
 * 씬 전체 기준 시각으로 재배치해 하나의 alignment 로 합치는 순수 함수 모듈.
 *
 * 씬 내부 TTS 청크 재생성(이슈 #113) 전용: scene-N-chunk-*.wav → scene-N.wav 로 concat 할 때 사용.
 *
 * 입력 가정:
 *   - 모든 청크는 동일한 sampleRate / channels / bitDepth 로 생성되었음
 *   - 44-byte RIFF 헤더 + PCM LE16 data 포맷 (pcmToWav() 의 출력 형식)
 *   - alignment 는 해당 청크 내부의 상대 시각
 */

const WAV_HEADER_SIZE = 44;

export interface WavChunkInput {
  buffer: Buffer;
  alignment?: AudioAlignment;
}

export interface AssembledSceneAudio {
  buffer: Buffer;
  durationSec: number;
  alignment?: AudioAlignment;
}

export function assembleSceneAudio(
  chunks: WavChunkInput[],
  audioConfig: AudioConfig,
): AssembledSceneAudio {
  if (chunks.length === 0) {
    throw new Error('assembleSceneAudio: chunks 가 비어있음');
  }

  const { sampleRate, channels, bitDepth } = audioConfig;
  const sampleWidth = bitDepth / 8;
  const bytesPerSec = sampleRate * channels * sampleWidth;

  // PCM data 만 추출 + 청크별 오프셋(초) 계산
  const pcmParts: Buffer[] = [];
  const chunkOffsetsSec: number[] = [];
  let cumulativeBytes = 0;

  for (const chunk of chunks) {
    if (chunk.buffer.length <= WAV_HEADER_SIZE) {
      throw new Error(`assembleSceneAudio: WAV 버퍼가 헤더보다 짧음 (${chunk.buffer.length} bytes)`);
    }
    const pcm = chunk.buffer.subarray(WAV_HEADER_SIZE);
    chunkOffsetsSec.push(cumulativeBytes / bytesPerSec);
    pcmParts.push(pcm);
    cumulativeBytes += pcm.length;
  }

  const totalPcm = Buffer.concat(pcmParts);
  const dataSize = totalPcm.length;

  const header = Buffer.alloc(WAV_HEADER_SIZE);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * channels * sampleWidth, 28);
  header.writeUInt16LE(channels * sampleWidth, 32);
  header.writeUInt16LE(bitDepth, 34);
  header.write('data', 36);
  header.writeUInt32LE(dataSize, 40);

  const buffer = Buffer.concat([header, totalPcm]);
  const durationSec = dataSize / bytesPerSec;

  const alignment = mergeAlignments(chunks, chunkOffsetsSec);

  return { buffer, durationSec, alignment };
}

/**
 * 각 청크의 alignment 를 씬 전체 기준 시각으로 offset 하여 합친다.
 * 단 하나라도 alignment 누락이면 전체 alignment 는 undefined 로 둔다
 * (부분 alignment 는 순방향 싱크에서 혼란을 유발).
 */
function mergeAlignments(
  chunks: WavChunkInput[],
  chunkOffsetsSec: number[],
): AudioAlignment | undefined {
  if (chunks.some(c => !c.alignment)) return undefined;

  const characters: string[] = [];
  const startTimes: number[] = [];
  const endTimes: number[] = [];

  for (let i = 0; i < chunks.length; i++) {
    const align = chunks[i].alignment!;
    const offset = chunkOffsetsSec[i];
    characters.push(...align.characters);
    for (const t of align.character_start_times_seconds) startTimes.push(t + offset);
    for (const t of align.character_end_times_seconds) endTimes.push(t + offset);
  }

  return {
    characters,
    character_start_times_seconds: startTimes,
    character_end_times_seconds: endTimes,
  };
}
