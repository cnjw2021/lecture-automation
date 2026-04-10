import { AudioAlignment, AudioConfig } from '../interfaces/IAudioProvider';
import { buildWav } from '../utils/WavAnalysisUtils';
import { SceneNarrationSegment } from './NarrationChunker';

/** 씬별로 분할된 오디오 결과 */
export interface SceneAudioSegment {
  sceneId: number;
  buffer: Buffer;
  durationSec: number;
  alignment: AudioAlignment;
}

const WAV_HEADER_SIZE = 44;

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
): SceneAudioSegment[] {
  const { sampleRate, channels, bitDepth } = audioConfig;
  const bytesPerFrame = channels * (bitDepth / 8);
  const bytesPerSecond = sampleRate * bytesPerFrame;
  const pcmData = wavBuffer.subarray(WAV_HEADER_SIZE);
  const totalDurationSec = pcmData.length / bytesPerSecond;

  const lastSegment = segments[segments.length - 1];
  const expectedLength = lastSegment.startCharIndex + lastSegment.charCount;
  if (alignment.characters.length !== expectedLength) {
    throw new Error(
      `alignment 문자 수(${alignment.characters.length})와 청크 텍스트 길이(${expectedLength})가 불일치합니다. ` +
      `TTS 프로바이더가 줄바꿈/공백을 정규화했을 수 있습니다.`,
    );
  }

  const results: SceneAudioSegment[] = [];

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    const nextSegment = segments[i + 1];

    const startTimeSec = i === 0
      ? 0
      : alignment.character_start_times_seconds[segment.startCharIndex];

    const endTimeSec = nextSegment
      ? alignment.character_start_times_seconds[nextSegment.startCharIndex]
      : totalDurationSec;

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

  return results;
}

/** 바이트 오프셋을 프레임 경계에 맞춰 내림 정렬한다. */
function alignToFrame(byteOffset: number, bytesPerFrame: number): number {
  return Math.floor(byteOffset / bytesPerFrame) * bytesPerFrame;
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
