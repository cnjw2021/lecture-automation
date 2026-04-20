import * as fs from 'fs-extra';
import { Lecture } from '../../domain/entities/Lecture';
import { ILectureRepository } from '../../domain/interfaces/ILectureRepository';
import { ISTTProvider, STTSceneAuditResult } from '../../domain/interfaces/ISTTProvider';

export interface AuditTTSUseCaseOptions {
  sceneIds?: number[];
  excludeSceneIds?: number[];
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
    const { sceneIds, excludeSceneIds = [] } = options;

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

      console.log(`  🎧 Scene ${scene.scene_id} 検査中...`);

      try {
        const result = await this.sttProvider.audit(audioPath, scene.narration, scene.scene_id);
        results.push(result);

        if (result.passed === true) {
          console.log(`     ✅ 異常なし`);
        } else {
          console.log(`     ⚠️  ${result.findings.length}件 検出`);
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
}
