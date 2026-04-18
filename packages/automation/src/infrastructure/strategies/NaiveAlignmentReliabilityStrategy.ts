import {
  BackToBackBoundaryContext,
  BoundaryChar,
  BoundaryClassification,
  IAlignmentReliabilityStrategy,
} from '../../domain/interfaces/IAlignmentReliabilityStrategy';

/**
 * alignment 에 특이한 왜곡이 없다고 가정하는 기본 전략.
 *
 * prev >= next 상황은 alignment 자체가 시공간적으로 깨끗한 경우 거의 발생하지 않는다.
 * 만일 발생하더라도 prev 에서 컷하여 다음 씬 앞머리에 있을지도 모를 무음을 함께 넘기는
 * 보수적 선택을 한다.
 *
 * ElevenLabs 처럼 char duration inflate 가 자주 일어나는 프로바이더에는 적합하지 않다.
 */
export class NaiveAlignmentReliabilityStrategy implements IAlignmentReliabilityStrategy {
  classifyBackToBackBoundary(ctx: BackToBackBoundaryContext): BoundaryClassification {
    const prevSpeechEndMs = ctx.prevChar.endMs;
    return {
      searchMinMs: prevSpeechEndMs,
      searchMaxMs: prevSpeechEndMs,
      searchAnchorMs: prevSpeechEndMs,
      reasons: ['naive-cut-at-prev'],
    };
  }

  isFirstCharInflated(_char: BoundaryChar): boolean {
    return false;
  }
}
