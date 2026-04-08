import * as fs from 'fs-extra';
import * as path from 'path';
import { config } from '../../infrastructure/config';
import { resolveDefaultAlignmentPath } from '../../infrastructure/config/masterAudioPaths';
import {
  printAlignmentFailureHints,
  PythonMasterAudioAlignmentProvider,
  resolveAlignmentPythonCommand,
} from '../../infrastructure/providers/PythonMasterAudioAlignmentProvider';

type CliArgs = {
  jsonFileName: string;
  masterAudioPath: string;
  outputPath?: string;
  modelName: string;
  usedLegacyPositionalArgs: boolean;
};

function parseCliArgs(argv: string[]): CliArgs | null {
  const [, , jsonFileName, masterAudioPath, ...rest] = argv;
  if (!jsonFileName || !masterAudioPath) {
    return null;
  }

  let outputPath: string | undefined;
  let modelName = 'small';
  let usedLegacyPositionalArgs = false;

  for (let index = 0; index < rest.length; index++) {
    const token = rest[index];
    if (token === '--output' || token === '-o') {
      outputPath = rest[index + 1];
      index += 1;
      continue;
    }
    if (token === '--model' || token === '-m') {
      modelName = rest[index + 1] || modelName;
      index += 1;
      continue;
    }

    // 하위 호환: 3번째 positional은 output, 4번째 positional은 model로 해석
    if (!outputPath) {
      outputPath = token;
      usedLegacyPositionalArgs = true;
      continue;
    }
    if (modelName === 'small') {
      modelName = token;
      usedLegacyPositionalArgs = true;
    }
  }

  return { jsonFileName, masterAudioPath, outputPath, modelName, usedLegacyPositionalArgs };
}

async function runAlignMasterAudio(jsonFileName: string, masterAudioPath: string, outputPath?: string, modelName = 'small') {
  const lecturePath = path.join(config.paths.data, jsonFileName);
  if (!await fs.pathExists(lecturePath)) {
    console.error(`❌ 파일을 찾을 수 없습니다: ${lecturePath}`);
    process.exit(1);
  }
  if (!await fs.pathExists(masterAudioPath)) {
    console.error(`❌ 마스터 오디오를 찾을 수 없습니다: ${masterAudioPath}`);
    process.exit(1);
  }

  const alignmentProvider = new PythonMasterAudioAlignmentProvider();

  const resolvedOutputPath = outputPath ? path.resolve(outputPath) : resolveDefaultAlignmentPath(config.paths.root, jsonFileName);

  console.log(`🧭 마스터 오디오 alignment 생성: ${jsonFileName}`);
  console.log(`   - master: ${masterAudioPath}`);
  console.log(`   - output: ${resolvedOutputPath}`);
  console.log(`   - model : ${modelName}`);
  console.log(`   - python: ${resolveAlignmentPythonCommand()}`);

  await alignmentProvider.generateAlignment({
    lecturePath,
    masterAudioPath,
    outputPath: resolvedOutputPath,
    modelName,
  });
  console.log('\n✅ alignment.json 생성 완료');
  console.log(`   ${resolvedOutputPath}`);
}

if (require.main === module) {
  const args = parseCliArgs(process.argv);
  if (!args) {
    console.error('사용법: node align-master-audio.js <lecture.json> <master-audio-path> [--output path] [--model small]');
    process.exit(1);
  }
  if (args.usedLegacyPositionalArgs) {
    console.warn('⚠️ positional output/model 인자는 하위 호환용입니다. 앞으로는 `--output`, `--model` 플래그를 사용해 주세요.');
  }

  runAlignMasterAudio(args.jsonFileName, args.masterAudioPath, args.outputPath, args.modelName).catch(error => {
    console.error('\n❌ alignment 생성 실패');
    printAlignmentFailureHints(error);
    console.error(error);
    process.exit(1);
  });
}
