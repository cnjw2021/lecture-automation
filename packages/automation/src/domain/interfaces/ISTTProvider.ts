export interface STTFinding {
  timeSec: number;
  expected: string;
  actual: string;
  reason?: string;
}

export interface STTSceneAuditResult {
  sceneId: number;
  /** true: 이상 없음 / false: 의심 구간 발견 / 'error': API 호출 실패 */
  passed: boolean | 'error';
  findings: STTFinding[];
  /** passed === 'error' 일 때 에러 메시지 */
  errorMessage?: string;
  /** 다수결 모드에서 finding이 발견된 실행 횟수 */
  hitRuns?: number;
}

export interface ISTTProvider {
  readonly providerName: string;
  audit(audioPath: string, narration: string, sceneId: number): Promise<STTSceneAuditResult>;
}
