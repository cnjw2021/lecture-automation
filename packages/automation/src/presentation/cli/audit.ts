/**
 * audit.ts
 *
 * TTS 오독 자동 감사 CLI (Gemini 2.5 Flash STT 대조)
 *
 * Usage:
 *   npx tsx audit.ts lecture-01-04.json
 *   npx tsx audit.ts lecture-01-04.json --scene 31
 *   npx tsx audit.ts lecture-01-04.json --scene '5 12 31'
 *   AUDIT_PROVIDER=gemini npx tsx audit.ts lecture-01-04.json
 *
 * Exit codes:
 *   0 — 모든 씬 통과 (또는 경고만)
 *   1 — 오독 의심 구간 발견
 *   2 — 사용법 오류
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import { Lecture } from '../../domain/entities/Lecture';
import { AuditTTSUseCase, AuditReport } from '../../application/use-cases/AuditTTSUseCase';
import { GeminiSTTProvider } from '../../infrastructure/providers/GeminiSTTProvider';
import { FileLectureRepository } from '../../infrastructure/repositories/FileLectureRepository';
import { config } from '../../infrastructure/config';

interface CliOptions {
  sceneIds: number[];
  runs?: number;
}

function parseArgs(args: string[]): { jsonFileName: string; options: CliOptions } {
  if (args.length === 0) {
    printUsage();
    process.exit(2);
  }

  const jsonFileName = args[0];

  const sceneFlag = args.indexOf('--scene');
  let sceneIds: number[] = [];
  if (sceneFlag !== -1 && args[sceneFlag + 1]) {
    sceneIds = args[sceneFlag + 1]
      .split(/[,\s]+/)
      .map(s => s.trim())
      .filter(Boolean)
      .map(Number)
      .filter(n => !isNaN(n));
  }

  const runsFlag = args.indexOf('--runs');
  let runs: number | undefined;
  if (runsFlag !== -1 && args[runsFlag + 1]) {
    const n = parseInt(args[runsFlag + 1], 10);
    if (!isNaN(n) && n >= 1) runs = n;
  }

  return { jsonFileName, options: { sceneIds, runs } };
}

function printUsage() {
  console.error('Usage: audit.ts <lecture-XX.json> [--scene <id|ids>] [--runs N]');
  console.error('  例: audit.ts lecture-01-04.json --scene 31');
  console.error('  例: audit.ts lecture-01-04.json --scene "5 12 31" --runs 3');
}

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = (sec % 60).toFixed(1).padStart(4, '0');
  return `${String(m).padStart(2, '0')}:${s}`;
}

function printReport(report: AuditReport): void {
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`🎧 Audit: ${report.lectureId}  (${report.auditedScenes}/${report.totalScenes} 씬, provider: ${report.providerName})`);
  console.log('─'.repeat(60));

  for (const result of report.results) {
    if (result.passed === true) {
      console.log(`  씬 ${String(result.sceneId).padStart(3)}  ✅ 이상 없음`);
    } else if (result.passed === 'error') {
      console.log(`  씬 ${String(result.sceneId).padStart(3)}  ❌ API 에러: ${result.errorMessage ?? ''}`);
    } else {
      console.log(`  씬 ${String(result.sceneId).padStart(3)}  ⚠️  ${result.findings.length}건 의심`);
      for (const f of result.findings) {
        console.log(`    @ ${formatTime(f.timeSec)}  원문: ${f.expected}   실제: ${f.actual}  [❌]`);
      }
    }
  }

  if (report.skippedScenes > 0) {
    console.log(`\n  ⏭️  ${report.skippedScenes}씬 스킵 (음성 파일 없음)`);
  }

  console.log('─'.repeat(60));
  const parts = [`${report.passedScenes}/${report.auditedScenes} 씬 통과`, `${report.warningScenes} 씬 의심 (총 ${report.totalFindingCount}건)`];
  if (report.errorScenes > 0) parts.push(`${report.errorScenes} 씬 에러`);
  console.log(`요약: ${parts.join(', ')}`);
}

async function main() {
  const { jsonFileName, options } = parseArgs(process.argv.slice(2));

  const auditConfig = config.getAuditConfig();

  if (auditConfig.providerName !== 'gemini') {
    console.error(`❌ 현재 지원 provider: gemini. AUDIT_PROVIDER=${auditConfig.providerName} 는 미구현.`);
    process.exit(2);
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('❌ GEMINI_API_KEY 환경변수가 설정되어 있지 않습니다.');
    process.exit(2);
  }

  const lecturePath = path.join(config.paths.data, jsonFileName);
  if (!await fs.pathExists(lecturePath)) {
    console.error(`❌ 파일을 찾을 수 없습니다: ${lecturePath}`);
    process.exit(2);
  }

  const lecture = JSON.parse(await fs.readFile(lecturePath, 'utf8')) as Lecture;
  const sttProvider = new GeminiSTTProvider({
    apiKey,
    modelName: auditConfig.modelName,
    temperature: auditConfig.temperature,
  });
  const lectureRepository = new FileLectureRepository();
  const auditUseCase = new AuditTTSUseCase(sttProvider, lectureRepository);

  console.log(`\n🔍 TTS Audit: ${jsonFileName}`);
  if (options.sceneIds.length > 0) {
    console.log(`   対象씬: ${options.sceneIds.join(', ')}`);
  }

  const runs = options.runs ?? auditConfig.runs;
  if (runs && runs > 1) {
    console.log(`   runs: ${runs}回 (1回でも⚠️ → 疑い判定)`);
  }

  const report = await auditUseCase.execute(lecture, {
    sceneIds: options.sceneIds.length > 0 ? options.sceneIds : undefined,
    excludeSceneIds: auditConfig.excludeScenes,
    runs,
  });

  printReport(report);

  process.exit(report.warningScenes > 0 || report.errorScenes > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('\n❌ Audit 중 치명적 오류:', err);
  process.exit(1);
});
