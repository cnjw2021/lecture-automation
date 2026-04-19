/**
 * validate-lecture-schema.ts
 *
 * Usage:
 *   npx tsx src/presentation/cli/validate-lecture-schema.ts lecture-01-03.json [--strict]
 *
 * 롤아웃 전략:
 *   - 기본: warning 모드 (오류가 있어도 exit 0)
 *   - --strict: 오류 시 exit 1
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import { Lecture } from '../../domain/entities/Lecture';
import { validateRemotionVisualProps, printPropValidationResult, ValidationMode } from '../../domain/validation/validateRemotionVisualProps';
import { config } from '../../infrastructure/config';

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error('Usage: validate-lecture-schema <lecture-XX.json> [--strict]');
    process.exit(1);
  }

  const jsonFileName = args[0];
  const mode: ValidationMode = args.includes('--strict') ? 'strict' : 'warning';

  const lecturePath = path.join(config.paths.data, jsonFileName);
  if (!await fs.pathExists(lecturePath)) {
    console.error(`❌ 파일을 찾을 수 없습니다: ${lecturePath}`);
    process.exit(1);
  }

  const rawData = await fs.readFile(lecturePath, 'utf8');
  const lecture = JSON.parse(rawData) as Lecture;

  console.log(`\n🔍 Schema validation: ${jsonFileName} (mode=${mode})`);

  try {
    const result = validateRemotionVisualProps(lecture.sequence, mode);
    printPropValidationResult(result);
  } catch (err) {
    console.error(`❌ ${(err as Error).message}`);
    process.exit(1);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
