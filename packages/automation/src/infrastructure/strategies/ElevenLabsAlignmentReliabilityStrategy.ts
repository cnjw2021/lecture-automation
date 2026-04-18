import {
  BackToBackBoundaryContext,
  BoundaryChar,
  BoundaryClassification,
  IAlignmentReliabilityStrategy,
} from '../../domain/interfaces/IAlignmentReliabilityStrategy';

/**
 * ElevenLabs v3 은 씬 간 무음을 별도의 gap 으로 남기지 않고, 구두점·다음 문자 등에
 * 흡수시키는 경향이 있다. 예:
 *   - 句点 `。` 의 end_time 이 이후 무음까지 끌어안아 1초+ 로 inflate
 *   - 다음 씬 첫 char 의 start_time 이 이전 씬 end_time 과 동일하게 기록되면서
 *     char duration 이 무음만큼 inflate
 *
 * 이 전략은 prev/next char duration 과 silent 기호 여부로 4-way 분기하여 컷 위치를
 * 결정한다.
 */

/**
 * prev 또는 next char 의 duration 이 이 값을 넘으면 TTS 가 무음을 흡수했다고 판정한다.
 * 일본어 일반 char 는 80~200ms, 장음 (ー)·촉음도 300ms 이내.
 */
const INFLATION_THRESHOLD_MS = 350;

/**
 * next 흡수 판정 시 RMS 를 앞으로 확장할 최대 폭. 과도 확장 시 다음 씬 발화를 침범한다.
 */
const MAX_TAIL_EXTENSION_MS = 500;

/**
 * 발화 없는 기호. 다음 씬 첫 char 가 이 집합에 있으면 char 전체가 무음이므로
 * forward 확장 대신 prev 에서 컷한다 — 흡수된 무음은 씬 N+1 앞머리에 남긴다.
 */
const SILENT_START_CHARS = new Set([
  '「', '」', '『', '』', '（', '）', '(', ')',
  '"', '“', '”', "'", '‘', '’',
  '〜', '～', 'ー', '・', '　', ' ',
]);

export class ElevenLabsAlignmentReliabilityStrategy implements IAlignmentReliabilityStrategy {
  classifyBackToBackBoundary(ctx: BackToBackBoundaryContext): BoundaryClassification {
    const { prevChar, nextChar, minCutMs } = ctx;
    const prevSpeechEndMs = prevChar.endMs;
    const prevCharDurationMs = prevChar.endMs - prevChar.startMs;
    // next char duration 은 prev 끝 이후 남은 길이로 측정한다. alignment 상
    // nextChar.startMs ≤ prevChar.endMs 이므로 이 값이 실제로 "무음 후 발화" 구간을 반영한다.
    const nextCharDurationMs = nextChar.endMs - prevSpeechEndMs;
    const isNextSilent = SILENT_START_CHARS.has(nextChar.text);

    if (prevCharDurationMs > INFLATION_THRESHOLD_MS) {
      return {
        searchMinMs: prevSpeechEndMs,
        searchMaxMs: prevSpeechEndMs,
        searchAnchorMs: prevSpeechEndMs,
        reasons: [`prev-inflated(${prevCharDurationMs}ms)`],
      };
    }

    if (isNextSilent) {
      return {
        searchMinMs: prevSpeechEndMs,
        searchMaxMs: prevSpeechEndMs,
        searchAnchorMs: prevSpeechEndMs,
        reasons: [`next-silent-char(${nextChar.text})`],
      };
    }

    if (nextCharDurationMs > INFLATION_THRESHOLD_MS) {
      const forwardCap = Math.min(prevSpeechEndMs + MAX_TAIL_EXTENSION_MS, nextChar.endMs);
      const searchMinMs = Math.max(minCutMs, prevSpeechEndMs);
      const searchMaxMs = Math.max(searchMinMs, forwardCap);
      const searchAnchorMs = Math.round((searchMinMs + searchMaxMs) / 2);
      return {
        searchMinMs,
        searchMaxMs,
        searchAnchorMs,
        reasons: [`next-inflated(${nextCharDurationMs}ms)-forward-extended`],
      };
    }

    return {
      searchMinMs: prevSpeechEndMs,
      searchMaxMs: prevSpeechEndMs,
      searchAnchorMs: prevSpeechEndMs,
      reasons: [`natural-boundary(prevDur=${prevCharDurationMs}ms,nextDur=${nextCharDurationMs}ms)`],
    };
  }

  isFirstCharInflated(char: BoundaryChar): boolean {
    return (char.endMs - char.startMs) > INFLATION_THRESHOLD_MS;
  }
}
