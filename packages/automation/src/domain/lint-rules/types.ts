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
  run(lecture: any): LintIssue[];
}

export interface LintResult {
  issues: LintIssue[];
  fixedCount: number;
}
