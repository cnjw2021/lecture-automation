import { AudioAlignment, AudioConfig } from '../interfaces/IAudioProvider';
import { buildWav } from './WavAnalysisUtils';

/**
 * 여러 청크 WAV 버퍼를 하나로 병합하고, 각 청크의 alignment 를
 * 씬 전체 기준 시각으로 재배치해 하나의 alignment 로 합치는 순수 함수 모듈.
 *
 * 씬 내부 TTS 청크 재생성(이슈 #113) 전용: scene-N-chunk-*.wav → scene-N.wav 로 concat 할 때 사용.
 *
 * 청크 간 자연스러운 호흡을 위해 기본적으로 두 가지 후처리를 적용한다:
 *   - 각 청크의 head/tail 무음 trim (ElevenLabs 류가 청크 앞뒤에 삽입하는 warmup/tail silence 제거)
 *   - 인접 청크 경계에 선형 crossfade (기본 30ms) — 양쪽 청크의 샘플을 gain 적용해 겹쳐 더함
 *
 * 입력 가정:
 *   - 모든 청크는 동일한 sampleRate / channels / bitDepth 로 생성되었음
 *   - 44-byte RIFF 헤더 + PCM LE16 data 포맷 (pcmToWav() 의 출력 형식)
 *   - bitDepth=16 만 지원
 *   - alignment 는 해당 청크 내부의 상대 시각
 */

const WAV_HEADER_SIZE = 44;
export const DEFAULT_CROSSFADE_MS = 0;
export const DEFAULT_BOUNDARY_GAP_MS = 220;
export const DEFAULT_SILENCE_THRESHOLD_INT16 = 512; // 약 -36 dBFS

export interface WavChunkInput {
  buffer: Buffer;
  alignment?: AudioAlignment;
}

export interface AssembledSceneAudio {
  buffer: Buffer;
  durationSec: number;
  alignment?: AudioAlignment;
}

export interface AssembleSceneAudioOptions {
  /**
   * 청크 경계에 선형 crossfade 를 적용할 길이 (ms). gap > 0 이면 자동 무시 (의미 없음).
   * gap 없이 sound 를 직접 이어붙일 때 클릭 방지용. 기본 0.
   */
  crossfadeMs?: number;
  /** 각 청크의 head/tail 무음 trim 활성화. 기본 true. 전부 무음인 청크는 안전장치로 trim 스킵. */
  trimSilence?: boolean;
  /** 무음으로 간주할 int16 절대값 임계. 기본 512 (약 -36 dBFS). */
  silenceThresholdInt16?: number;
  /**
   * 청크 경계에 삽입할 무음 길이 (ms). 문장 사이 자연스러운 들숨 간격을 복원한다.
   * trim 으로 각 청크의 꼬리/머리 무음이 제거되므로 이 gap 이 호흡 역할을 한다.
   * 기본 220. 0 이면 경계 gap 없음 (crossfadeMs 만 적용).
   */
  boundaryGapMs?: number;
}

export function assembleSceneAudio(
  chunks: WavChunkInput[],
  audioConfig: AudioConfig,
  options: AssembleSceneAudioOptions = {},
): AssembledSceneAudio {
  if (chunks.length === 0) {
    throw new Error('assembleSceneAudio: chunks 가 비어있음');
  }

  const {
    crossfadeMs = DEFAULT_CROSSFADE_MS,
    trimSilence = true,
    silenceThresholdInt16 = DEFAULT_SILENCE_THRESHOLD_INT16,
    boundaryGapMs = DEFAULT_BOUNDARY_GAP_MS,
  } = options;

  const { sampleRate, channels, bitDepth } = audioConfig;
  if (bitDepth !== 16) {
    throw new Error(`assembleSceneAudio: 16-bit PCM 만 지원 (bitDepth=${bitDepth})`);
  }

  const sampleWidth = bitDepth / 8;
  const bytesPerFrame = channels * sampleWidth;
  // gap 이 있으면 경계가 이미 silence 로 분리되므로 crossfade 는 무의미.
  const effectiveCrossfadeMs = boundaryGapMs > 0 ? 0 : crossfadeMs;
  const crossfadeFrames = Math.max(0, Math.floor((effectiveCrossfadeMs / 1000) * sampleRate));
  const gapFrames = Math.max(0, Math.floor((boundaryGapMs / 1000) * sampleRate));

  // 1) 청크별 PCM 추출 + trim
  interface Processed {
    pcm: Buffer;
    headTrimSec: number;
  }
  const processed: Processed[] = [];
  for (const chunk of chunks) {
    if (chunk.buffer.length <= WAV_HEADER_SIZE) {
      throw new Error(`assembleSceneAudio: WAV 버퍼가 헤더보다 짧음 (${chunk.buffer.length} bytes)`);
    }
    const rawPcm = chunk.buffer.subarray(WAV_HEADER_SIZE);
    if (!trimSilence) {
      processed.push({ pcm: Buffer.from(rawPcm), headTrimSec: 0 });
      continue;
    }
    const { pcm, headTrimFrames } = trimEdgeSilence(
      rawPcm,
      channels,
      bytesPerFrame,
      silenceThresholdInt16,
    );
    processed.push({ pcm, headTrimSec: headTrimFrames / sampleRate });
  }

  // 2) 경계별 실제 crossfade 길이. 양쪽 청크 절반 이상은 못 넘음 (안전장치).
  const cfFrames: number[] = [];
  for (let i = 0; i < processed.length - 1; i++) {
    const framesA = processed[i].pcm.length / bytesPerFrame;
    const framesB = processed[i + 1].pcm.length / bytesPerFrame;
    cfFrames.push(
      Math.min(crossfadeFrames, Math.floor(framesA / 2), Math.floor(framesB / 2)),
    );
  }

  // 3) 각 청크의 씬 기준 시작 frame 및 총 길이 계산
  //    경계에서 crossfade 는 겹침(-), gap 은 삽입(+) 으로 작용. 보통 둘 중 하나만 활성.
  const chunkStartFrames: number[] = [];
  let cursor = 0;
  for (let i = 0; i < processed.length; i++) {
    chunkStartFrames.push(cursor);
    const frames = processed[i].pcm.length / bytesPerFrame;
    cursor += frames;
    if (i < processed.length - 1) {
      cursor -= cfFrames[i];
      cursor += gapFrames;
    }
  }
  const totalFrames = cursor;
  const totalBytes = totalFrames * bytesPerFrame;

  // 4) 출력 PCM 에 각 청크 샘플 add (crossfade 구간은 선형 gain 적용)
  const outPcm = Buffer.alloc(totalBytes, 0);
  for (let i = 0; i < processed.length; i++) {
    const { pcm } = processed[i];
    const frames = pcm.length / bytesPerFrame;
    const startFrame = chunkStartFrames[i];
    const leadingCf = i > 0 ? cfFrames[i - 1] : 0;
    const trailingCf = i < processed.length - 1 ? cfFrames[i] : 0;

    for (let f = 0; f < frames; f++) {
      let gain = 1;
      if (leadingCf > 0 && f < leadingCf) {
        gain *= (f + 1) / (leadingCf + 1); // linear fade-in (이전 청크 tail 과 합해 1 에 수렴)
      }
      if (trailingCf > 0 && f >= frames - trailingCf) {
        const k = frames - f; // k: 1..trailingCf
        gain *= k / (trailingCf + 1); // linear fade-out
      }
      const outFrameIdx = startFrame + f;
      for (let c = 0; c < channels; c++) {
        const inOff = f * bytesPerFrame + c * sampleWidth;
        const outOff = outFrameIdx * bytesPerFrame + c * sampleWidth;
        const sample = pcm.readInt16LE(inOff);
        const existing = outPcm.readInt16LE(outOff);
        const mixed = clampInt16(Math.round(existing + sample * gain));
        outPcm.writeInt16LE(mixed, outOff);
      }
    }
  }

  const buffer = buildWav(outPcm, sampleRate, channels, bitDepth);
  const durationSec = totalFrames / sampleRate;

  const alignment = mergeAlignments(
    chunks,
    processed.map((p, i) => ({
      headTrimSec: p.headTrimSec,
      startSec: chunkStartFrames[i] / sampleRate,
    })),
  );

  return { buffer, durationSec, alignment };
}

/**
 * head/tail 무음을 제거한 PCM 과 head 에서 제거된 프레임 수를 반환.
 * PCM 이 전부 무음이면 원본을 그대로 반환 (안전장치 — 빈 버퍼 방지).
 */
function trimEdgeSilence(
  pcm: Buffer,
  channels: number,
  bytesPerFrame: number,
  threshold: number,
): { pcm: Buffer; headTrimFrames: number } {
  const totalFrames = Math.floor(pcm.length / bytesPerFrame);
  if (totalFrames === 0) return { pcm: Buffer.from(pcm), headTrimFrames: 0 };

  const isLoudFrame = (frameIdx: number): boolean => {
    const base = frameIdx * bytesPerFrame;
    for (let c = 0; c < channels; c++) {
      const v = pcm.readInt16LE(base + c * 2);
      if (Math.abs(v) > threshold) return true;
    }
    return false;
  };

  let headFrame = 0;
  while (headFrame < totalFrames && !isLoudFrame(headFrame)) headFrame++;

  if (headFrame >= totalFrames) {
    // 전부 무음 — 원본 유지
    return { pcm: Buffer.from(pcm), headTrimFrames: 0 };
  }

  let tailFrame = totalFrames - 1;
  while (tailFrame > headFrame && !isLoudFrame(tailFrame)) tailFrame--;

  const startByte = headFrame * bytesPerFrame;
  const endByte = (tailFrame + 1) * bytesPerFrame;
  return {
    pcm: Buffer.from(pcm.subarray(startByte, endByte)),
    headTrimFrames: headFrame,
  };
}

function clampInt16(v: number): number {
  if (v > 32767) return 32767;
  if (v < -32768) return -32768;
  return v;
}

/**
 * 각 청크의 alignment 를 씬 전체 기준 시각으로 재배치해 합친다.
 * head trim 만큼 각 청크의 character time 을 당기고, 청크 시작 프레임 기준 offset 을 더한다.
 * 하나라도 alignment 누락이면 전체 alignment 는 undefined.
 */
function mergeAlignments(
  chunks: WavChunkInput[],
  chunkSceneInfo: { headTrimSec: number; startSec: number }[],
): AudioAlignment | undefined {
  if (chunks.some(c => !c.alignment)) return undefined;

  const characters: string[] = [];
  const startTimes: number[] = [];
  const endTimes: number[] = [];

  for (let i = 0; i < chunks.length; i++) {
    const align = chunks[i].alignment!;
    const shift = chunkSceneInfo[i].startSec - chunkSceneInfo[i].headTrimSec;
    characters.push(...align.characters);
    for (const t of align.character_start_times_seconds) {
      startTimes.push(Math.max(0, t + shift));
    }
    for (const t of align.character_end_times_seconds) {
      endTimes.push(Math.max(0, t + shift));
    }
  }

  return {
    characters,
    character_start_times_seconds: startTimes,
    character_end_times_seconds: endTimes,
  };
}
