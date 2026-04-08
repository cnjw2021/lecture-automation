/**
 * CLI: 강의 단위 TTS 마스터 오디오에서 alignment.json 생성
 * 사용법: node align-master-audio.js <lecture.json> <master-audio-path> [--output path] [--model small]
 */
import { execFile } from 'child_process';
import * as fs from 'fs-extra';
import * as path from 'path';
import { config } from '../../infrastructure/config';

function resolvePythonCommand(): string {
  const venvPython = path.join(config.paths.root, '.venv-align', 'bin', 'python');
  return fs.existsSync(venvPython) ? venvPython : 'python3';
}

function runPythonAlignment(lecturePath: string, masterAudioPath: string, outputPath: string, modelName: string): Promise<void> {
  const scriptPath = path.join(config.paths.root, 'scripts', 'generate-alignment.py');
  const pythonCmd = resolvePythonCommand();
  return new Promise((resolve, reject) => {
    execFile(
      pythonCmd,
      [scriptPath, lecturePath, masterAudioPath, outputPath, '--model', modelName],
      {
        maxBuffer: 1024 * 1024 * 50,
        env: {
          ...process.env,
          KMP_DUPLICATE_LIB_OK: process.env.KMP_DUPLICATE_LIB_OK || 'TRUE',
          TOKENIZERS_PARALLELISM: process.env.TOKENIZERS_PARALLELISM || 'false',
        },
      },
      (error, stdout, stderr) => {
        if (stdout.trim()) process.stdout.write(stdout);
        if (stderr.trim()) process.stderr.write(stderr);
        if (error) {
          reject(error);
          return;
        }
        resolve();
      }
    );
  });
}

function resolveDefaultOutput(jsonFileName: string): string {
  const lectureStem = path.basename(jsonFileName, path.extname(jsonFileName));
  return path.join(config.paths.root, 'tmp', 'audio-segmentation', lectureStem, 'alignment.json');
}

function printAlignmentFailureHints(error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);

  if (message.includes('libiomp5.dylib already initialized')) {
    console.error('힌트: OpenMP 런타임 충돌입니다. 기본적으로 KMP_DUPLICATE_LIB_OK=TRUE를 주입하지만,');
    console.error('      전역 Python 환경 대신 `.venv-align` 가상환경을 사용하면 재현성이 더 좋아집니다.');
  }
  if (message.includes('NumPy 1.x cannot be run in NumPy 2')) {
    console.error('힌트: 정렬용 Python 환경의 NumPy 버전이 맞지 않습니다.');
    console.error('      `make install-align-deps`로 `.venv-align`을 다시 생성해 주세요.');
  }
}

type CliArgs = {
  jsonFileName: string;
  masterAudioPath: string;
  outputPath?: string;
  modelName: string;
};

function parseCliArgs(argv: string[]): CliArgs | null {
  const [, , jsonFileName, masterAudioPath, ...rest] = argv;
  if (!jsonFileName || !masterAudioPath) {
    return null;
  }

  let outputPath: string | undefined;
  let modelName = 'small';

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
      continue;
    }
    if (modelName === 'small') {
      modelName = token;
    }
  }

  return { jsonFileName, masterAudioPath, outputPath, modelName };
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

  const resolvedOutputPath = outputPath ? path.resolve(outputPath) : resolveDefaultOutput(jsonFileName);

  console.log(`🧭 마스터 오디오 alignment 생성: ${jsonFileName}`);
  console.log(`   - master: ${masterAudioPath}`);
  console.log(`   - output: ${resolvedOutputPath}`);
  console.log(`   - model : ${modelName}`);
  console.log(`   - python: ${resolvePythonCommand()}`);

  await runPythonAlignment(lecturePath, masterAudioPath, resolvedOutputPath, modelName);
  console.log('\n✅ alignment.json 생성 완료');
  console.log(`   ${resolvedOutputPath}`);
}

if (require.main === module) {
  const args = parseCliArgs(process.argv);
  if (!args) {
    console.error('사용법: node align-master-audio.js <lecture.json> <master-audio-path> [--output path] [--model small]');
    process.exit(1);
  }

  runAlignMasterAudio(args.jsonFileName, args.masterAudioPath, args.outputPath, args.modelName).catch(error => {
    console.error('\n❌ alignment 생성 실패');
    printAlignmentFailureHints(error);
    console.error(error);
    process.exit(1);
  });
}
