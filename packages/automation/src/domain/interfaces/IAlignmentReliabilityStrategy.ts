/**
 * TTS 프로바이더별로 alignment (문자 단위 타임스탬프) 의 신뢰도 특성이 다르다.
 * 이 전략은 "prev 씬의 마지막 유효 char 가 끝난 시점 이후, next 씬의 첫 유효 char 가
 * 시작되는 시점이 동일하거나 앞서 있는" 경우 (= alignment 가 씬 간 무음 구간을 어느
 * char 에 흡수해버린 경우) 어떻게 컷 위치를 결정할지를 캡슐화한다.
 *
 * ChunkAudioSplitter 는 이 전략을 호출해 RMS 검색 창을 얻고, 프로바이더별 특이 지식
 * (어떤 char 가 무음을 흡수했는지, 어떤 기호가 silent 인지 등) 을 보유하지 않는다.
 */

export interface BoundaryChar {
  /** alignment.characters[i] */
  text: string;
  /** character_start_times_seconds[i] * 1000, 반올림 */
  startMs: number;
  /** character_end_times_seconds[i] * 1000, 반올림 */
  endMs: number;
}

export interface BackToBackBoundaryContext {
  /** 씬 N 의 마지막 유효 (end > start) char. */
  prevChar: BoundaryChar;
  /** 씬 N+1 의 첫 유효 char. */
  nextChar: BoundaryChar;
  /** 씬 N 의 최소 지속 시간을 보장하기 위한 하한. adjustedStartMs + MIN_SCENE_DURATION_MS. */
  minCutMs: number;
}

export interface BoundaryClassification {
  /** RMS 검색 하한. */
  searchMinMs: number;
  /** RMS 검색 상한. searchMinMs === searchMaxMs 이면 splitter 는 prev 에서 즉시 컷한다. */
  searchMaxMs: number;
  /** RMS tie-break anchor. 같은 RMS 프레임이 여러 개 있을 때 가장 가까운 프레임이 선택된다. */
  searchAnchorMs: number;
  /** BoundaryDiagnostic.reasons 에 덧붙일 설명. */
  reasons: string[];
}

/**
 * TTS 프로바이더별 alignment 신뢰도 전략.
 */
export interface IAlignmentReliabilityStrategy {
  /**
   * 씬 경계에서 prev 의 발화 종료 시각 >= next 의 발화 시작 시각인 경우 호출된다.
   * alignment 가 씬 간 무음 구간을 잃은 상태에서, 실제 컷 후보 구간을 반환한다.
   */
  classifyBackToBackBoundary(ctx: BackToBackBoundaryContext): BoundaryClassification;

  /**
   * 씬 선두의 첫 유효 char 가 "alignment 가 무음을 흡수한 inflated char" 인지 판정한다.
   * true 면 ChunkAudioSplitter 의 방어적 검사에서 cut 이 해당 char 내부에 있어도
   * 실제 발화 손실 없음으로 판단하고 허용한다.
   */
  isFirstCharInflated(char: BoundaryChar): boolean;
}
