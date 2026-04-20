import * as fs from 'fs-extra';
import { Lecture } from '../../domain/entities/Lecture';
import { ILectureRepository } from '../../domain/interfaces/ILectureRepository';
import { ISTTProvider, STTSceneAuditResult } from '../../domain/interfaces/ISTTProvider';
import { groupFindingsByWindow } from '../../domain/utils/STTFindingGrouping';

export interface AuditTTSUseCaseOptions {
  sceneIds?: number[];
  excludeSceneIds?: number[];
  /** 동일 씬을 몇 번 감사할지. 1번이라도 ⚠️ → 의심 판정 (기본: 1) */
  runs?: number;
}

export interface AuditReport {
  lectureId: string;
  providerName: string;
  totalScenes: number;
  auditedScenes: number;
  passedScenes: number;
  warningScenes: number;
  errorScenes: number;
  skippedScenes: number;
  results: STTSceneAuditResult[];
  totalFindingCount: number;
}

export class AuditTTSUseCase {
  constructor(
    private readonly sttProvider: ISTTProvider,
    private readonly lectureRepository: ILectureRepository,
  ) {}

  async execute(lecture: Lecture, options: AuditTTSUseCaseOptions = {}): Promise<AuditReport> {
    const { sceneIds, excludeSceneIds = [], runs = 1 } = options;

    const targetScenes = lecture.sequence.filter(scene => {
      if (excludeSceneIds.includes(scene.scene_id)) return false;
      if (sceneIds && sceneIds.length > 0) return sceneIds.includes(scene.scene_id);
      return true;
    });

    const results: STTSceneAuditResult[] = [];
    let skippedScenes = 0;

    for (const scene of targetScenes) {
      const audioPath = this.lectureRepository.getAudioPath(lecture.lecture_id, scene.scene_id);

      if (!await fs.pathExists(audioPath)) {
        console.warn(`  ⏭️  Scene ${scene.scene_id}: 音声ファイルなし — スキップ`);
        skippedScenes++;
        continue;
      }

      const runLabel = runs > 1 ? ` (${runs}回実行)` : '';
      console.log(`  🎧 Scene ${scene.scene_id} 検査中...${runLabel}`);

      try {
        const merged = await this.auditWithRetries(audioPath, scene.narration, scene.scene_id, runs);
        results.push(merged);

        if (merged.passed === true) {
          console.log(`     ✅ 異常なし`);
        } else {
          const hitRuns = merged.hitRuns ?? 1;
          const successRuns = merged.successRuns ?? runs;
          const failedSuffix = successRuns < runs ? ` / ${runs - successRuns}回失敗` : '';
          console.log(`     ⚠️  ${merged.findings.length}件 検出 (${hitRuns}/${successRuns}回で検出${failedSuffix})`);
        }
      } catch (error) {
        const msg = (error as Error).message;
        console.error(`     ❌ Scene ${scene.scene_id} 検査エラー: ${msg}`);
        results.push({ sceneId: scene.scene_id, passed: 'error', findings: [], errorMessage: msg });
      }
    }

    const passedScenes = results.filter(r => r.passed === true).length;

    const warningScenes = results.filter(r => r.passed === false).length;
    const errorScenes = results.filter(r => r.passed === 'error').length;
    const totalFindingCount = results.reduce((sum, r) => sum + r.findings.length, 0);

    return {
      lectureId: lecture.lecture_id,
      providerName: this.sttProvider.providerName,
      totalScenes: lecture.sequence.length,
      auditedScenes: results.length,
      passedScenes,
      warningScenes,
      errorScenes,
      skippedScenes,
      results,
      totalFindingCount,
    };
  }

  private async auditWithRetries(
    audioPath: string,
    narration: string,
    sceneId: number,
    runs: number,
  ): Promise<STTSceneAuditResult> {
    if (runs === 1) {
      const result = await this.sttProvider.audit(audioPath, narration, sceneId);
      return {
        ...result,
        hitRuns: result.passed === false ? 1 : 0,
        successRuns: 1,
      };
    }

    const runResults: STTSceneAuditResult[] = [];
    for (let i = 0; i < runs; i++) {
      try {
        const result = await this.sttProvider.audit(audioPath, narration, sceneId);
        runResults.push(result);
      } catch (error) {
        console.warn(`     run ${i + 1}/${runs} 失敗: ${(error as Error).message}`);
      }
    }

    if (runResults.length === 0) {
      throw new Error(`全 ${runs} 回失敗`);
    }

    const hitRuns = runResults.filter(r => r.passed === false).length;
    const allFindings = runResults.flatMap(r => r.findings);
    const findings = groupFindingsByWindow(allFindings);

    return {
      sceneId,
      passed: findings.length === 0,
      findings,
      hitRuns,
      successRuns: runResults.length,
    };
  }
}
