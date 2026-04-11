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
  targetMs: number;
  defaultCutMs: number;
  suggestedCutMs: number;
  appliedCutMs: number;
  appliedOffsetMs: number;
  usedOverride: boolean;
  detectedIssue: boolean;
  confidence: number;
  reasons: string[];
}

export interface SplitChunkAudioOptions {
  boundaryOverrides?: ReadonlyArray<BoundaryOverride>;
}

export interface SplitChunkAudioResult {
  scenes: SceneAudioSegment[];
  boundaries: BoundaryDiagnostic[];
}

const SEARCH_WINDOW_MS = 240;
const MIN_SCENE_DURATION_MS = 250;
const LONG_CHAR_MS = 1000;
const SHORT_CHAR_MS = 50;
const LATER_CANDIDATE_MIN_DELTA_MS = 30;
const EARLIER_CANDIDATE_MIN_DELTA_MS = 30;

interface SegmentTiming {
  sceneId: number;
  startCharIndex: number;
  charCount: number;
  textStartMs: number;
  textEndMs: number;
  adjustedStartMs: number;
  adjustedEndMs: number;
}

interface BoundaryCandidate {
  cutMs: number;
  rms: number;
}

/**
 * 청크 단위로 생성된 WAV + alignment를 씬별로 분할한다.
 *
 * alignment의 문자 단위 타임스탬프를 이용하여 각 씬의 시작/끝 시점을 특정하고,
 * PCM 데이터를 프레임 경계에 맞춰 분할한다.
 * 분할된 각 씬의 alignment는 시작 시각이 0으로 리베이스된다.
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
    const separatorCharIndex = segments[index].startCharIndex + segments[index].charCount;

    const separatorStartMs = getBoundaryTimeMs(
      alignment.character_start_times_seconds[separatorCharIndex],
      current.textEndMs,
    );
    const separatorEndMs = getBoundaryTimeMs(
      alignment.character_end_times_seconds[separatorCharIndex],
      next.textStartMs,
    );
    const targetMs = Math.round((separatorStartMs + separatorEndMs) / 2);
    const minMs = Math.max(
      current.adjustedStartMs + MIN_SCENE_DURATION_MS,
      separatorStartMs - SEARCH_WINDOW_MS,
    );
    const maxMs = Math.min(
      totalDurationMs,
      next.textEndMs - MIN_SCENE_DURATION_MS,
      separatorEndMs + SEARCH_WINDOW_MS,
    );

    const defaultCandidate = findLowestEnergyBoundary(targetMs, minMs, maxMs, frames);
    const diagnostic = analyzeBoundary(
      current,
      next,
      alignment,
      targetMs,
      minMs,
      maxMs,
      frames,
      defaultCandidate,
      boundaryOverrides,
    );
    const cutMs = diagnostic.appliedCutMs;
    current.adjustedEndMs = cutMs;
    next.adjustedStartMs = cutMs;
    diagnostics.push(diagnostic);
  }

  return diagnostics;
}

/** 바이트 오프셋을 프레임 경계에 맞춰 내림 정렬한다. */
function alignToFrame(byteOffset: number, bytesPerFrame: number): number {
  return Math.floor(byteOffset / bytesPerFrame) * bytesPerFrame;
}

function getBoundaryTimeMs(value: number | undefined, fallbackMs: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallbackMs;
  }
  return Math.round(value * 1000);
}

function findLowestEnergyBoundary(
  targetMs: number,
  minMs: number,
  maxMs: number,
  frames: RmsFrame[],
): BoundaryCandidate {
  if (maxMs <= minMs) {
    return {
      cutMs: Math.max(minMs, Math.min(maxMs, targetMs)),
      rms: Number.POSITIVE_INFINITY,
    };
  }

  const candidates = frames.filter(frame => frame.startMs >= minMs && frame.endMs <= maxMs);
  if (candidates.length === 0) {
    return {
      cutMs: Math.round(Math.max(minMs, Math.min(maxMs, targetMs))),
      rms: Number.POSITIVE_INFINITY,
    };
  }

  let best = candidates[0];
  let bestDistance = Math.abs(((best.startMs + best.endMs) / 2) - targetMs);

  for (const frame of candidates.slice(1)) {
    const center = (frame.startMs + frame.endMs) / 2;
    const distance = Math.abs(center - targetMs);
    if (frame.rms < best.rms || (frame.rms === best.rms && distance < bestDistance)) {
      best = frame;
      bestDistance = distance;
    }
  }

  return {
    cutMs: Math.round((best.startMs + best.endMs) / 2),
    rms: best.rms,
  };
}

function analyzeBoundary(
  current: SegmentTiming,
  next: SegmentTiming,
  alignment: AudioAlignment,
  targetMs: number,
  minMs: number,
  maxMs: number,
  frames: RmsFrame[],
  defaultCandidate: BoundaryCandidate,
  boundaryOverrides: ReadonlyArray<BoundaryOverride>,
): BoundaryDiagnostic {
  const reasons: string[] = [];
  const prevLastCharIndex = current.startCharIndex + current.charCount - 1;
  const nextFirstCharIndex = next.startCharIndex;
  const prevLastCharDurationMs = getCharDurationMs(alignment, prevLastCharIndex);
  const nextFirstCharDurationMs = getCharDurationMs(alignment, nextFirstCharIndex);
  const override = boundaryOverrides.find(item => item.fromSceneId === current.sceneId && item.toSceneId === next.sceneId);

  let suggestedCandidate = defaultCandidate;
  let detectedIssue = false;
  let confidence = 0;

  if (prevLastCharDurationMs <= SHORT_CHAR_MS && nextFirstCharDurationMs >= LONG_CHAR_MS) {
    detectedIssue = true;
    confidence = 0.85;
    reasons.push(
      `prevLastCharShort=${prevLastCharDurationMs}ms`,
      `nextFirstCharLong=${nextFirstCharDurationMs}ms`,
    );

    const laterCandidate = findLowestEnergyBoundary(
      targetMs + LATER_CANDIDATE_MIN_DELTA_MS,
      Math.max(minMs, targetMs + LATER_CANDIDATE_MIN_DELTA_MS),
      maxMs,
      frames,
    );
    if (
      laterCandidate.cutMs > defaultCandidate.cutMs
      && laterCandidate.cutMs - defaultCandidate.cutMs >= LATER_CANDIDATE_MIN_DELTA_MS
      && laterCandidate.rms <= defaultCandidate.rms * 1.2
    ) {
      suggestedCandidate = laterCandidate;
      reasons.push(`preferLaterCut=${laterCandidate.cutMs - defaultCandidate.cutMs}ms`);
    }
  } else if (prevLastCharDurationMs >= LONG_CHAR_MS && nextFirstCharDurationMs <= SHORT_CHAR_MS) {
    detectedIssue = true;
    confidence = 0.8;
    reasons.push(
      `prevLastCharLong=${prevLastCharDurationMs}ms`,
      `nextFirstCharShort=${nextFirstCharDurationMs}ms`,
    );

    const earlierCandidate = findLowestEnergyBoundary(
      targetMs - EARLIER_CANDIDATE_MIN_DELTA_MS,
      minMs,
      Math.min(maxMs, targetMs - EARLIER_CANDIDATE_MIN_DELTA_MS),
      frames,
    );
    if (
      earlierCandidate.cutMs < defaultCandidate.cutMs
      && defaultCandidate.cutMs - earlierCandidate.cutMs >= EARLIER_CANDIDATE_MIN_DELTA_MS
      && earlierCandidate.rms <= defaultCandidate.rms * 1.2
    ) {
      suggestedCandidate = earlierCandidate;
      reasons.push(`preferEarlierCut=${defaultCandidate.cutMs - earlierCandidate.cutMs}ms`);
    }
  }

  let appliedCutMs = suggestedCandidate.cutMs;
  let usedOverride = false;

  if (override) {
    appliedCutMs = clamp(targetMs + override.offsetMs, minMs, maxMs);
    usedOverride = true;
    reasons.push(`override=${override.offsetMs}ms`);
    if (override.reason) {
      reasons.push(`overrideReason=${override.reason}`);
    }
  }

  return {
    fromSceneId: current.sceneId,
    toSceneId: next.sceneId,
    targetMs,
    defaultCutMs: defaultCandidate.cutMs,
    suggestedCutMs: suggestedCandidate.cutMs,
    appliedCutMs,
    appliedOffsetMs: appliedCutMs - targetMs,
    usedOverride,
    detectedIssue,
    confidence,
    reasons,
  };
}

function getCharDurationMs(alignment: AudioAlignment, index: number): number {
  const start = alignment.character_start_times_seconds[index];
  const end = alignment.character_end_times_seconds[index];
  if (typeof start !== 'number' || typeof end !== 'number') {
    return 0;
  }
  return Math.max(0, Math.round((end - start) * 1000));
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** alignment 배열을 해당 씬의 문자 범위로 슬라이스하고, 시각을 0 기준으로 리베이스한다. */
function sliceAlignment(
  alignment: AudioAlignment,
  segment: SceneNarrationSegment,
  sceneStartTimeSec: number,
): AudioAlignment {
  const { startCharIndex, charCount } = segment;
  const end = startCharIndex + charCount;

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
