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
/**
 * prev >= next 일 때 (alignment 가 씬 간 무음을 다음 씬 첫 문자에 흡수한 경우)
 * RMS 를 이만큼 앞으로 확장해 실제 무음 valley 를 찾는다.
 * 과도하게 늘리면 다음 씬 발화를 침범할 수 있어 0.5초로 제한.
 */
const MAX_TAIL_EXTENSION_MS = 500;
/**
 * 씬 간 무음 흡수 판정 임계값. 어느 한쪽 char 의 duration 이 이 값을 넘으면
 * TTS 가 무음을 해당 char 에 흡수했다고 판단한다.
 * 일본어 일반 char 는 80-200ms, 장음(ー)·촉음도 300ms 이내.
 */
const INFLATION_THRESHOLD_MS = 350;
/**
 * 발화 없는 기호. 다음 씬 첫 char 가 이 집합에 있으면 char 전체가 무음이므로
 * forward 확장 대신 prev 에서 컷 — 흡수된 무음은 씬 N+1 앞머리에 그대로 남긴다.
 */
const SILENT_START_CHARS = new Set([
  '「', '」', '『', '』', '（', '）', '(', ')',
  '"', '“', '”', "'", '‘', '’',
  '〜', '～', 'ー', '・', '　', ' ',
]);

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
 *
 *   - Case A (prev < next, alignment 가 무음 구간을 명시):
 *       상한 = next, 하한 = max(adjustedStart + MIN_SCENE_DURATION_MS, prev)
 *       [하한, 상한] 에서 최저 RMS 프레임 선택. 상한/하한 tie-break 은 anchor = max(prev, next).
 *
 *   - Case B (prev >= next): alignment 는 씬 간 무음 정보를 잃었다. 어느 char 가 흡수했는지 판정.
 *       · B1 (prev char duration > INFLATION_THRESHOLD_MS): prev (보통 `。` 句点) 가 무음 흡수.
 *         prev_end 를 무음 flush 완료 지점으로 신뢰, prev 에서 컷.
 *       · B2 (next char duration > INFLATION_THRESHOLD_MS): next 가 무음 흡수. RMS 를 앞으로
 *         최대 MAX_TAIL_EXTENSION_MS 확장해 무음 valley 탐색. 상한 = min(prev + 500,
 *         next first char end). anchor 는 창의 중심.
 *       · B3 (둘 다 정상 duration): 자연스러운 back-to-back 발화. prev 에서 컷.
 *
 * 어느 경우에도 하한을 prev 이상으로 고정해 "이전 씬 꼬리 절단 (tail leak)" 을 차단한다.
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

    const prevLastChar = findLastNonzeroChar(alignment, current.startCharIndex, current.charCount);
    const prevSpeechEndMs = prevLastChar.endMs;
    const prevCharDurationMs = prevLastChar.endMs - prevLastChar.startMs;
    const nextFirstChar = findFirstNonzeroChar(alignment, next.startCharIndex, next.charCount);
    const nextSpeechStartMs = nextFirstChar.startMs;

    // Anchor: 진단·override tie-break 용. N 마지막 발화 끝과 N+1 첫 발화 시작 중 더 늦은 쪽.
    const anchorMs = Math.max(prevSpeechEndMs, nextSpeechStartMs);

    let searchMaxMs: number;
    let searchMinMs: number;
    let searchAnchorMs: number;
    const reasons: string[] = [];

    if (nextSpeechStartMs > prevSpeechEndMs) {
      // Case A — alignment 가 무음 구간을 명시. [prev, next] 에서 최저 RMS 선택.
      searchMaxMs = nextSpeechStartMs;
      searchMinMs = Math.min(
        searchMaxMs,
        Math.max(current.adjustedStartMs + MIN_SCENE_DURATION_MS, prevSpeechEndMs),
      );
      searchAnchorMs = anchorMs;
    } else {
      // Case B — prev >= next. 어느 쪽 char 가 씬 간 무음을 흡수했는지 판정.
      //   · prev 가 이미 inflated (예: 句点 `。` 가 1초+) → 신뢰 가능. prev 에서 컷.
      //   · next 가 silent char (예: `「`) 면 char 전체가 무음 → prev 에서 컷, 무음은 씬 N+1 앞머리에 남김.
      //   · next 가 inflated 이고 실제 speech char 면 → forward RMS 확장.
      //   · 둘 다 정상 duration → 자연스러운 back-to-back. prev 에서 컷.
      const nextCharDurationMs = nextFirstChar.endMs - prevSpeechEndMs;
      const isNextSilent = SILENT_START_CHARS.has(nextFirstChar.text);

      if (prevCharDurationMs > INFLATION_THRESHOLD_MS) {
        searchMinMs = prevSpeechEndMs;
        searchMaxMs = prevSpeechEndMs;
        searchAnchorMs = prevSpeechEndMs;
        reasons.push(`prev-inflated(${prevCharDurationMs}ms)`);
      } else if (isNextSilent) {
        searchMinMs = prevSpeechEndMs;
        searchMaxMs = prevSpeechEndMs;
        searchAnchorMs = prevSpeechEndMs;
        reasons.push(`next-silent-char(${nextFirstChar.text})`);
      } else if (nextCharDurationMs > INFLATION_THRESHOLD_MS) {
        const forwardCap = Math.min(prevSpeechEndMs + MAX_TAIL_EXTENSION_MS, nextFirstChar.endMs);
        searchMinMs = Math.max(current.adjustedStartMs + MIN_SCENE_DURATION_MS, prevSpeechEndMs);
        searchMaxMs = Math.max(searchMinMs, forwardCap);
        searchAnchorMs = Math.round((searchMinMs + searchMaxMs) / 2);
        reasons.push(`next-inflated(${nextCharDurationMs}ms)-forward-extended`);
      } else {
        searchMinMs = prevSpeechEndMs;
        searchMaxMs = prevSpeechEndMs;
        searchAnchorMs = prevSpeechEndMs;
        reasons.push(`natural-boundary(prevDur=${prevCharDurationMs}ms,nextDur=${nextCharDurationMs}ms)`);
      }
    }

    // 유효 창이 있으면 RMS 검색. 없으면 prev 에서 컷 (tail leak 감수, 다음 씬은 alignment 만 따라감).
    const suggestedCutMs = searchMaxMs > searchMinMs
      ? findLowestEnergyCut(searchAnchorMs, searchMinMs, searchMaxMs, frames)
      : prevSpeechEndMs;
    let appliedCutMs = suggestedCutMs;

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

/** N의 마지막 문자 중 end_time > start_time 인 문자의 {startMs, endMs}. v3 end_time=0 버그 대응. */
function findLastNonzeroChar(
  alignment: AudioAlignment,
  startCharIndex: number,
  charCount: number,
): { startMs: number; endMs: number } {
  const endIndex = startCharIndex + charCount - 1;
  for (let i = endIndex; i >= startCharIndex; i--) {
    const start = alignment.character_start_times_seconds[i];
    const end = alignment.character_end_times_seconds[i];
    if (typeof start === 'number' && typeof end === 'number' && end > start) {
      return { startMs: Math.round(start * 1000), endMs: Math.round(end * 1000) };
    }
  }
  // 모든 문자가 0ms duration인 극단적 케이스: 마지막 문자의 end_time(또는 0)
  const fallback = alignment.character_end_times_seconds[endIndex];
  const ms = typeof fallback === 'number' ? Math.round(fallback * 1000) : 0;
  return { startMs: ms, endMs: ms };
}

/** N+1의 첫 유효 char 의 {text, startMs, endMs}. v3 end_time=0 버그 대응. */
function findFirstNonzeroChar(
  alignment: AudioAlignment,
  startCharIndex: number,
  charCount: number,
): { text: string; startMs: number; endMs: number } {
  const endIndex = startCharIndex + charCount - 1;
  for (let i = startCharIndex; i <= endIndex; i++) {
    const start = alignment.character_start_times_seconds[i];
    const end = alignment.character_end_times_seconds[i];
    if (typeof start === 'number' && typeof end === 'number' && end > start) {
      return {
        text: alignment.characters[i] ?? '',
        startMs: Math.round(start * 1000),
        endMs: Math.round(end * 1000),
      };
    }
  }
  const fallbackStart = alignment.character_start_times_seconds[startCharIndex];
  const fallbackEnd = alignment.character_end_times_seconds[startCharIndex];
  return {
    text: alignment.characters[startCharIndex] ?? '',
    startMs: typeof fallbackStart === 'number' ? Math.round(fallbackStart * 1000) : 0,
    endMs: typeof fallbackEnd === 'number' ? Math.round(fallbackEnd * 1000) : 0,
  };
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
 * 경계 컷이 씬 선두의 실제 발화를 잘랐는지 방어적으로 검증한다. 단, 첫 유효 char 가
 * INFLATION_THRESHOLD_MS 를 넘는 inflated char 라면 alignment 가 무음을 흡수했다는
 * 의미이므로 cut 이 그 내부에 있어도 clamp 로 허용한다 (실제 발화 손실 없음).
 * 두 번째 이후 char 가 cut 이전에 있는 경우는 실제 발화 절단 — 즉시 throw.
 */
function sliceAlignment(
  alignment: AudioAlignment,
  segment: SceneNarrationSegment,
  sceneStartTimeSec: number,
): AudioAlignment {
  const { startCharIndex, charCount } = segment;
  const end = startCharIndex + charCount;
  const sceneStartMs = Math.round(sceneStartTimeSec * 1000);

  let firstNonzeroSeen = false;
  for (let i = startCharIndex; i < end; i++) {
    const startSec = alignment.character_start_times_seconds[i];
    const endSec = alignment.character_end_times_seconds[i];
    const isNonzero = typeof startSec === 'number'
      && typeof endSec === 'number'
      && endSec > startSec;
    if (!isNonzero) continue;
    const startMs = Math.round(startSec * 1000);
    const endMs = Math.round(endSec * 1000);
    if (startMs < sceneStartMs) {
      const droppedMs = sceneStartMs - startMs;
      const charDurationMs = endMs - startMs;
      const isFirstInflated = !firstNonzeroSeen && charDurationMs > INFLATION_THRESHOLD_MS;
      if (isFirstInflated) {
        // Inflated 첫 char: alignment 가 무음을 흡수한 상태. cut 이 내부에 있어도 실제 발화 손실 없음.
        firstNonzeroSeen = true;
        continue;
      }
      throw new Error(
        `[ChunkAudioSplitter] 씬 ${segment.sceneId} 선두 발화 절단 감지: ` +
        `문자 [${i}] '${alignment.characters[i]}' 가 cut ${sceneStartMs}ms 이전 (${startMs}ms) 에 있음. ` +
        `dropped=${droppedMs}ms (charDur=${charDurationMs}ms) — boundary 알고리즘 버그.`
      );
    }
    firstNonzeroSeen = true;
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
