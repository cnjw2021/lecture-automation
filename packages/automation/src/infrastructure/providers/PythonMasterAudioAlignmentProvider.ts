import { execFile } from 'child_process';
import * as fs from 'fs-extra';
import * as path from 'path';
import { IMasterAudioAlignmentProvider, MasterAudioAlignmentRequest } from '../../domain/interfaces/IMasterAudioAlignmentProvider';
import { config } from '../config';

export function resolveAlignmentPythonCommand(): string {
  const venvPython = path.join(config.paths.root, '.venv-align', 'bin', 'python');
  return fs.existsSync(venvPython) ? venvPython : 'python3';
}

export function printAlignmentFailureHints(error: unknown): void {
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

export class PythonMasterAudioAlignmentProvider implements IMasterAudioAlignmentProvider {
  async generateAlignment(request: MasterAudioAlignmentRequest): Promise<void> {
    const scriptPath = path.join(config.paths.root, 'scripts', 'generate-alignment.py');
    const pythonCmd = resolveAlignmentPythonCommand();
    const args = [
      scriptPath,
      request.lecturePath,
      request.masterAudioPath,
      request.outputPath,
      '--model',
      request.modelName,
    ];

    await new Promise<void>((resolve, reject) => {
      execFile(
        pythonCmd,
        args,
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
}
