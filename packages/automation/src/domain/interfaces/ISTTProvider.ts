export interface STTFinding {
  timeSec: number;
  expected: string;
  actual: string;
  reason?: string;
}

export interface STTSceneAuditResult {
  sceneId: number;
  passed: boolean;
  findings: STTFinding[];
}

export interface ISTTProvider {
  readonly providerName: string;
  audit(audioPath: string, narration: string, sceneId: number): Promise<STTSceneAuditResult>;
}
