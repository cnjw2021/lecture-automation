import { AudioAlignment, AudioConfig } from '../interfaces/IAudioProvider';
import { buildWav, computeRmsFrames, readWavMetadata, RmsFrame } from '../utils/WavAnalysisUtils';
import { SceneNarrationSegment } from './NarrationChunker';

/** 씬별로 분할된 오디오 결과 */
export interface SceneAudioSegment {
  sceneId: number;
  buffer: Buffer;
  durationSec: number;
  alignment: AudioAlignment;
}

export interface BoundaryOverride {
  fromSceneId: number;
  toSceneId: number;
  offsetMs: number;
  reason?: string;
}

export interface BoundaryDiagnostic {
  fromSceneId: number;
  toSceneId: number;
  /** N 마지막 유효 문자의 end_time (nonzero 보정 후) */
  prevSpeechEndMs: number;
  /** N+1 첫 유효 문자의 start_time (nonzero 보정 후) */
  nextSpeechStartMs: number;
  /** 경계 anchor — max(prevSpeechEndMs, nextSpeechStartMs) */
  anchorMs: number;
  /** backward-bounded RMS 검색으로 찾은 cut 위치 (nextSpeechStartMs 이하가 보장됨) */
  suggestedCutMs: number;
  /** 최종 적용된 cut 위치 */
  appliedCutMs: number;
  appliedOffsetMs: number;
  usedOverride: boolean;
  reasons: string[];
}

export interface SplitChunkAudioOptions {
  boundaryOverrides?: ReadonlyArray<BoundaryOverride>;
}

export interface SplitChunkAudioResult {
  scenes: SceneAudioSegment[];
  boundaries: BoundaryDiagnostic[];
}

const MIN_SCENE_DURATION_MS = 250;

interface SegmentTiming {
  sceneId: number;
  startCharIndex: number;
  charCount: number;
  textStartMs: number;
  textEndMs: number;
  adjustedStartMs: number;
  adjustedEndMs: number;
}

/**
 * 청크 단위로 생성된 WAV + alignment를 씬별로 분할한다.
 *
 * 경계 컷 알고리즘:
 *   prev = N 의 마지막 유효(end>start) char 의 end_time
 *   next = N+1 의 첫 유효 char 의 start_time
 *   상한 searchMax = next  (엄격 — 이 이후로는 절대 컷하지 않음)
 *   하한 searchMin = max(adjustedStart + MIN_SCENE_DURATION_MS, prev) (단, ≤ searchMax)
 *
 *   - prev < next  (alignment 가 무음 구간을 명시): [prev, next] 에서 최저 RMS 프레임 선택
 *   - prev >= next (ElevenLabs v3 등에서 무음이 기록되지 않거나 trailing 문자 end_time 에 흡수): next 에서 컷
 *
 * next 를 엄격 상한으로 고정해 "다음 씬 앞머리 절단 (head leak)" 을 원천 차단하고,
 * 하한을 prev 로 고정해 "이전 씬 꼬리 절단 (tail leak)" 을 차단한다. 상한·하한이 같으면
 * 단순히 next 에서 컷하며, 이 경우 N 은 자기 speech + 씬 간 자연 무음을 그대로 보존하고
 * N+1 은 speech onset 에서 crisp 하게 시작한다.
 *
 * ElevenLabs v3의 end_time=0 버그를 감안하여, 0ms duration 문자는 "유효" 판정에서 건너뛴다.
 */
export function splitChunkAudio(
  wavBuffer: Buffer,
  alignment: AudioAlignment,
  segments: ReadonlyArray<SceneNarrationSegment>,
  audioConfig: AudioConfig,
  options: SplitChunkAudioOptions = {},
): SplitChunkAudioResult {
  const metadata = readWavMetadata(wavBuffer);
  const { sampleRate, channels, bitDepth } = metadata;
  if (
    sampleRate !== audioConfig.sampleRate
    || channels !== audioConfig.channels
    || bitDepth !== audioConfig.bitDepth
  ) {
    throw new Error(
      `청크 WAV 포맷(${sampleRate}Hz/${channels}ch/${bitDepth}bit)이 설정값과 다릅니다. ` +
      `expected=${audioConfig.sampleRate}Hz/${audioConfig.channels}ch/${audioConfig.bitDepth}bit`,
    );
  }
  const bytesPerFrame = channels * (bitDepth / 8);
  const bytesPerSecond = sampleRate * bytesPerFrame;
  const pcmData = wavBuffer.subarray(metadata.dataOffset, metadata.dataOffset + metadata.dataSize);
  const totalDurationSec = pcmData.length / bytesPerSecond;
  const totalDurationMs = Math.round(totalDurationSec * 1000);

  const lastSegment = segments[segments.length - 1];
  const expectedLength = lastSegment.startCharIndex + lastSegment.charCount;
  if (alignment.characters.length !== expectedLength) {
    throw new Error(
      `alignment 문자 수(${alignment.characters.length})와 청크 텍스트 길이(${expectedLength})가 불일치합니다. ` +
      `TTS 프로바이더가 줄바꿈/공백을 정규화했을 수 있습니다.`,
    );
  }

  const frames = computeRmsFrames(wavBuffer, metadata);
  const timings = buildSegmentTimings(segments, alignment, totalDurationMs);
  const boundaries = adjustSegmentBoundaries(
    timings,
    segments,
    alignment,
    totalDurationMs,
    frames,
    options.boundaryOverrides ?? [],
  );

  const results: SceneAudioSegment[] = [];

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    const timing = timings[i];
    const startTimeSec = timing.adjustedStartMs / 1000;
    const endTimeSec = timing.adjustedEndMs / 1000;

    const startByte = alignToFrame(startTimeSec * bytesPerSecond, bytesPerFrame);
    const endByte = Math.min(
      alignToFrame(endTimeSec * bytesPerSecond, bytesPerFrame),
      pcmData.length,
    );

    const pcmSlice = pcmData.subarray(startByte, endByte);
    const durationSec = pcmSlice.length / bytesPerSecond;
    const buffer = buildWav(pcmSlice, sampleRate, channels, bitDepth);

    const sceneAlignment = sliceAlignment(alignment, segment, startTimeSec);

    results.push({
      sceneId: segment.sceneId,
      buffer,
      durationSec,
      alignment: sceneAlignment,
    });
  }

  return {
    scenes: results,
    boundaries,
  };
}

function buildSegmentTimings(
  segments: ReadonlyArray<SceneNarrationSegment>,
  alignment: AudioAlignment,
  totalDurationMs: number,
): SegmentTiming[] {
  return segments.map((segment, index) => {
    const endCharIndex = segment.startCharIndex + segment.charCount - 1;
    const textStartMs = index === 0
      ? 0
      : Math.round(alignment.character_start_times_seconds[segment.startCharIndex] * 1000);
    const textEndMs = Math.round(alignment.character_end_times_seconds[endCharIndex] * 1000);

    return {
      sceneId: segment.sceneId,
      startCharIndex: segment.startCharIndex,
      charCount: segment.charCount,
      textStartMs,
      textEndMs,
      adjustedStartMs: index === 0 ? 0 : textStartMs,
      adjustedEndMs: index === segments.length - 1 ? totalDurationMs : textEndMs,
    };
  });
}

function adjustSegmentBoundaries(
  timings: SegmentTiming[],
  segments: ReadonlyArray<SceneNarrationSegment>,
  alignment: AudioAlignment,
  totalDurationMs: number,
  frames: RmsFrame[],
  boundaryOverrides: ReadonlyArray<BoundaryOverride>,
): BoundaryDiagnostic[] {
  const diagnostics: BoundaryDiagnostic[] = [];

  if (timings.length <= 1) {
    if (timings.length === 1) {
      timings[0].adjustedStartMs = 0;
      timings[0].adjustedEndMs = totalDurationMs;
    }
    return diagnostics;
  }

  timings[0].adjustedStartMs = 0;
  timings[timings.length - 1].adjustedEndMs = totalDurationMs;

  for (let index = 0; index < timings.length - 1; index++) {
    const current = timings[index];
    const next = timings[index + 1];

    const prevSpeechEndMs = findLastNonzeroCharEndMs(alignment, current.startCharIndex, current.charCount);
    const nextSpeechStartMs = findFirstNonzeroCharStartMs(alignment, next.startCharIndex, next.charCount);

    // Anchor: 진단·override tie-break 용. N 마지막 발화 끝과 N+1 첫 발화 시작 중 더 늦은 쪽.
    const anchorMs = Math.max(prevSpeechEndMs, nextSpeechStartMs);

    // 엄격 상한: N+1 의 aligned speech start (head leak 차단)
    const searchMaxMs = nextSpeechStartMs;
    // 엄격 하한: N 의 aligned speech end (tail leak 차단). 단 상한을 넘지 않도록 보정.
    const searchMinMs = Math.min(
      searchMaxMs,
      Math.max(current.adjustedStartMs + MIN_SCENE_DURATION_MS, prevSpeechEndMs),
    );

    // 무음 구간이 alignment 에 명시된 경우에만 RMS 검색. 아니면 next 에서 컷.
    const suggestedCutMs = searchMaxMs > searchMinMs
      ? findLowestEnergyCut(anchorMs, searchMinMs, searchMaxMs, frames)
      : nextSpeechStartMs;
    let appliedCutMs = suggestedCutMs;

    const reasons: string[] = [];

    const override = boundaryOverrides.find(
      item => item.fromSceneId === current.sceneId && item.toSceneId === next.sceneId,
    );
    let usedOverride = false;
    if (override) {
      appliedCutMs = clamp(anchorMs + override.offsetMs, searchMinMs, searchMaxMs);
      usedOverride = true;
      reasons.push(`override=${override.offsetMs}ms`);
      if (override.reason) {
        reasons.push(`overrideReason=${override.reason}`);
      }
    }

    current.adjustedEndMs = appliedCutMs;
    next.adjustedStartMs = appliedCutMs;

    diagnostics.push({
      fromSceneId: current.sceneId,
      toSceneId: next.sceneId,
      prevSpeechEndMs,
      nextSpeechStartMs,
      anchorMs,
      suggestedCutMs,
      appliedCutMs,
      appliedOffsetMs: appliedCutMs - anchorMs,
      usedOverride,
      reasons,
    });
  }

  return diagnostics;
}

/** N의 마지막 문자 중 end_time > start_time 인 문자의 end_time(ms). v3 end_time=0 버그 대응. */
function findLastNonzeroCharEndMs(
  alignment: AudioAlignment,
  startCharIndex: number,
  charCount: number,
): number {
  const endIndex = startCharIndex + charCount - 1;
  for (let i = endIndex; i >= startCharIndex; i--) {
    const start = alignment.character_start_times_seconds[i];
    const end = alignment.character_end_times_seconds[i];
    if (typeof start === 'number' && typeof end === 'number' && end > start) {
      return Math.round(end * 1000);
    }
  }
  // 모든 문자가 0ms duration인 극단적 케이스: 첫 문자의 end_time(또는 0)
  const fallback = alignment.character_end_times_seconds[endIndex];
  return typeof fallback === 'number' ? Math.round(fallback * 1000) : 0;
}

/** N+1의 첫 문자 중 end_time > start_time 인 문자의 start_time(ms). */
function findFirstNonzeroCharStartMs(
  alignment: AudioAlignment,
  startCharIndex: number,
  charCount: number,
): number {
  const endIndex = startCharIndex + charCount - 1;
  for (let i = startCharIndex; i <= endIndex; i++) {
    const start = alignment.character_start_times_seconds[i];
    const end = alignment.character_end_times_seconds[i];
    if (typeof start === 'number' && typeof end === 'number' && end > start) {
      return Math.round(start * 1000);
    }
  }
  const fallback = alignment.character_start_times_seconds[startCharIndex];
  return typeof fallback === 'number' ? Math.round(fallback * 1000) : 0;
}

/**
 * [minMs, maxMs] 범위에서 RMS 최저 프레임의 중심 시각을 cut으로 반환.
 * 여러 프레임이 같은 RMS이면 anchorMs 에 가장 가까운 프레임을 선호한다.
 */
function findLowestEnergyCut(
  anchorMs: number,
  minMs: number,
  maxMs: number,
  frames: RmsFrame[],
): number {
  if (maxMs <= minMs) {
    return Math.max(minMs, Math.min(maxMs, anchorMs));
  }

  const candidates = frames.filter(frame => frame.startMs >= minMs && frame.endMs <= maxMs);
  if (candidates.length === 0) {
    return Math.round(Math.max(minMs, Math.min(maxMs, anchorMs)));
  }

  let best = candidates[0];
  let bestDistance = Math.abs(((best.startMs + best.endMs) / 2) - anchorMs);

  for (const frame of candidates.slice(1)) {
    const center = (frame.startMs + frame.endMs) / 2;
    const distance = Math.abs(center - anchorMs);
    if (frame.rms < best.rms || (frame.rms === best.rms && distance < bestDistance)) {
      best = frame;
      bestDistance = distance;
    }
  }

  return Math.round((best.startMs + best.endMs) / 2);
}

/** 바이트 오프셋을 프레임 경계에 맞춰 내림 정렬한다. */
function alignToFrame(byteOffset: number, bytesPerFrame: number): number {
  return Math.floor(byteOffset / bytesPerFrame) * bytesPerFrame;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * alignment 배열을 해당 씬의 문자 범위로 슬라이스하고, 시각을 0 기준으로 리베이스한다.
 *
 * 경계 컷이 씬 선두의 실제 발화를 잘랐는지 방어적으로 검증한다. 기존에는 음수 시간을
 * 0 으로 clamp 해 절단 사실을 은폐했으나, 이제 유효 발화 문자(end > start)가
 * 씬 시작 이전에 위치하면 즉시 throw 한다. clamp 는 v3 의 end_time=0 문자(아직
 * 발음 위치가 확정되지 않은 공백·줄바꿈)에 대해서만 허용된다.
 */
function sliceAlignment(
  alignment: AudioAlignment,
  segment: SceneNarrationSegment,
  sceneStartTimeSec: number,
): AudioAlignment {
  const { startCharIndex, charCount } = segment;
  const end = startCharIndex + charCount;
  const sceneStartMs = Math.round(sceneStartTimeSec * 1000);

  for (let i = startCharIndex; i < end; i++) {
    const startSec = alignment.character_start_times_seconds[i];
    const endSec = alignment.character_end_times_seconds[i];
    const isNonzero = typeof startSec === 'number'
      && typeof endSec === 'number'
      && endSec > startSec;
    if (!isNonzero) continue;
    const startMs = Math.round(startSec * 1000);
    if (startMs < sceneStartMs) {
      const droppedMs = sceneStartMs - startMs;
      throw new Error(
        `[ChunkAudioSplitter] 씬 ${segment.sceneId} 선두 발화 절단 감지: ` +
        `문자 [${i}] '${alignment.characters[i]}' 가 cut ${sceneStartMs}ms 이전 (${startMs}ms) 에 있음. ` +
        `dropped=${droppedMs}ms — boundary 알고리즘 버그.`
      );
    }
  }

  return {
    characters: alignment.characters.slice(startCharIndex, end),
    character_start_times_seconds: alignment.character_start_times_seconds
      .slice(startCharIndex, end)
      .map(t => Math.max(0, t - sceneStartTimeSec)),
    character_end_times_seconds: alignment.character_end_times_seconds
      .slice(startCharIndex, end)
      .map(t => Math.max(0, t - sceneStartTimeSec)),
  };
}
