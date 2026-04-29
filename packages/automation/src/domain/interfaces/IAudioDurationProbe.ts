/**
 * Audio file 의 길이를 추출하는 도메인 인터페이스.
 *
 * #141 F-2: RecordVisualUseCase 가 capture 직후 manifest.totalDurationMs 와
 * 오디오 길이를 비교하기 위해 도입. WAV 헤더 파싱은 인프라 책임이므로
 * 도메인은 인터페이스만 노출하고 use-case 는 이를 주입받는다.
 */
export interface IAudioDurationProbe {
  /**
   * 지정된 오디오 파일의 재생 길이(ms) 를 반환한다.
   * 파일이 없거나 포맷이 지원되지 않으면 null.
   */
  probeDurationMs(audioPath: string): Promise<number | null>;
}
