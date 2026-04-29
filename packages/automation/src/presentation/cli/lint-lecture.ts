/**
 * lint-lecture.ts
 *
 * 강의 JSON 파일에 대한 lint 검사. 자동 수정 가능한 이슈는 --fix 로 적용.
 *
 * Usage:
 *   npx tsx src/presentation/cli/lint-lecture.ts lecture-01-04.json
 *   npx tsx src/presentation/cli/lint-lecture.ts lecture-01-04.json --fix
 *   npx tsx src/presentation/cli/lint-lecture.ts lecture-01-04.json --strict
 *
 * Exit codes:
 *   0 — 이슈 없음 (또는 warning 만 있고 strict 아님)
 *   1 — error 이슈가 남아있음 (또는 strict 모드에서 warning 도 포함)
 *   2 — 사용법 오류
 *
 * --fix 동작:
 *   - 자동 수정 가능한 이슈에 대해 lecture JSON 을 in-place 수정 후 저장
 *   - 수정 후 다시 lint 실행하여 남은 이슈 보고
 *   - 자동 수정만으로 모든 error 가 해소되면 exit 0
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import { allRules, asyncRules, LintIssue, LintResult } from '../../domain/lint-rules';
import { config } from '../../infrastructure/config';

interface CliOptions {
  fix: boolean;
  strict: boolean;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    printUsage();
    process.exit(2);
  }

  const jsonFileName = args[0];
  const options: CliOptions = {
    fix: args.includes('--fix'),
    strict: args.includes('--strict'),
  };

  const lecturePath = path.join(config.paths.data, jsonFileName);
  if (!await fs.pathExists(lecturePath)) {
    console.error(`❌ 파일을 찾을 수 없습니다: ${lecturePath}`);
    process.exit(2);
  }

  const lecture = JSON.parse(await fs.readFile(lecturePath, 'utf8'));

  console.log(`\n🔍 Lint: ${jsonFileName}${options.fix ? ' (--fix)' : ''}${options.strict ? ' (--strict)' : ''}`);

  // 1차 lint
  let result = await runAllRules(lecture);
  printIssues(result.issues, '1차 검사');

  // --fix 모드: 자동 수정 가능 이슈 적용
  if (options.fix && result.issues.some(i => i.fix)) {
    const fixable = result.issues.filter(i => i.fix);
    console.log(`\n🔧 자동 수정 적용 중... (${fixable.length}건)`);
    const seenFixDescs = new Set<string>();
    for (const issue of fixable) {
      issue.fix!(lecture);
      const desc = `  • scene ${issue.sceneId}: ${issue.fixDescription ?? issue.message}`;
      if (!seenFixDescs.has(desc)) {
        console.log(desc);
        seenFixDescs.add(desc);
      }
    }
    await fs.writeFile(lecturePath, JSON.stringify(lecture, null, 2) + '\n', 'utf8');
    console.log(`✅ ${jsonFileName} 저장 완료`);

    // 2차 lint (재검사)
    result = await runAllRules(lecture);
    printIssues(result.issues, '2차 검사 (수정 후)');
  }

  // exit code 결정
  const errorCount = result.issues.filter(i => i.severity === 'error').length;
  const warningCount = result.issues.filter(i => i.severity === 'warning').length;

  console.log(`\n📊 결과: error ${errorCount}건 / warning ${warningCount}건`);

  if (errorCount > 0) {
    if (options.fix) {
      console.log('\n💡 일부 error 는 자동 수정 불가 — 위 메시지를 확인하고 수동 수정해 주세요.');
    } else {
      console.log('\n💡 자동 수정 가능한 항목은 `--fix` 옵션으로 처리할 수 있습니다.');
    }
    process.exit(1);
  }

  if (options.strict && warningCount > 0) {
    console.log('\n💡 --strict 모드: warning 도 차단 사유로 처리됨');
    process.exit(1);
  }

  console.log('\n✅ 검사 통과');
}

async function runAllRules(lecture: any): Promise<LintResult> {
  const issues: LintIssue[] = [];
  for (const rule of allRules) {
    issues.push(...rule.run(lecture));
  }
  for (const rule of asyncRules) {
    issues.push(...await rule.run(lecture));
  }
  // scene_id 오름차순, 동일 씬은 ruleId 순으로 정렬
  issues.sort((a, b) => {
    const aId = a.sceneId ?? -1;
    const bId = b.sceneId ?? -1;
    if (aId !== bId) return aId - bId;
    return a.ruleId.localeCompare(b.ruleId);
  });
  return { issues, fixedCount: 0 };
}

function printIssues(issues: LintIssue[], header: string): void {
  console.log(`\n── ${header} (${issues.length}건) ──`);
  if (issues.length === 0) {
    console.log('  (없음)');
    return;
  }
  for (const issue of issues) {
    const icon = issue.severity === 'error' ? '❌' : '⚠️';
    const sceneLabel = issue.sceneId !== null ? `scene ${issue.sceneId}` : 'lecture';
    console.log(`  ${icon} [${issue.ruleId}] ${sceneLabel}: ${issue.message}`);
    if (issue.context) {
      console.log(`     ↳ "${issue.context}"`);
    }
  }
}

function printUsage(): void {
  console.error('Usage: lint-lecture <lecture-XX.json> [--fix] [--strict]');
  console.error('  --fix     자동 수정 가능한 이슈를 적용 (파일 in-place 수정)');
  console.error('  --strict  warning 도 exit 1 로 처리');
}

main().catch(err => {
  console.error(err);
  process.exit(2);
});
