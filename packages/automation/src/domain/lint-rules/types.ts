/**
 * Lint 룰 공통 타입.
 *
 * 룰은 Lecture 전체를 받아 LintIssue 배열을 반환한다. 자동 수정 가능한 이슈는
 * fix 함수를 동봉하며, --fix 모드에서 호출된다.
 */

export type Severity = 'error' | 'warning';

export interface LintIssue {
  ruleId: string;
  sceneId: number | null;
  severity: Severity;
  message: string;
  /** 검출된 원문 일부 (사용자 가독용). */
  context?: string;
  /** 자동 수정 가능한 경우 fix 함수 (Lecture를 in-place 수정). */
  fix?: (lecture: any) => void;
  /** 수정 후 변경 요약 (사용자 보고용). */
  fixDescription?: string;
}

export interface LintRule {
  id: string;
  description: string;
  /**
   * STRICT 모드 전용 룰. true 면 일반 `make lint` 에서는 침묵하고,
   * `make lint STRICT=1` 에서만 실행된다. 휴리스틱 경고가 많아 진짜 문제 시그널을
   * 묻을 위험이 있는 룰을 격리하는 용도.
   *
   * #141 옵션 A: G-playwright-sync-coverage 가 첫 적용 사례. 진짜 sync 검증은
   * sync-preview 가 담당하므로 G-rule 은 보조 용도로 격하.
   */
  strictOnly?: boolean;
  run(lecture: any): LintIssue[];
}

/**
 * 외부 자원(파일 시스템 등)을 읽어야 하는 비동기 룰. lint-lecture CLI 가
 * 동기 룰 다음에 실행한다. 룰이 동기일 수 있는지 비동기일 수 있는지는 호출자가
 * 인식할 수 있도록 두 인터페이스를 분리.
 *
 * 예: I-audio-narration-coherence 는 alignment.json 을 읽어 narration 과 비교.
 */
export interface AsyncLintRule {
  id: string;
  description: string;
  run(lecture: any): Promise<LintIssue[]>;
}

export interface LintResult {
  issues: LintIssue[];
  fixedCount: number;
}
