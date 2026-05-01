import { spawn } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { AudioAlignment, AudioConfig, AudioGenerateResult } from '../../domain/interfaces/IAudioProvider';

export interface PythonTtsRequest {
  text: string;
  voice: string;
  engineParams: Record<string, unknown>;
}

export interface PythonTtsBridgeOptions {
  engine: string;
  workspaceRoot: string;
  audioConfig: AudioConfig;
  pythonTimeoutMs?: number;
}

interface BridgeResponse {
  ok: boolean;
  error?: string;
  audioPath?: string;
  durationSec?: number;
  alignment?: AudioAlignment | null;
}

export class PythonTtsBridge {
  constructor(private readonly options: PythonTtsBridgeOptions) {}

  async synthesize(request: PythonTtsRequest): Promise<AudioGenerateResult> {
    const engineDir = path.join(this.options.workspaceRoot, 'tools/tts/python', this.options.engine);
    if (!fs.existsSync(engineDir)) {
      throw new Error(
        `[${this.options.engine}] TTS 엔진 디렉토리가 없습니다: ${engineDir}. ` +
        `make tts-bootstrap-${this.options.engine} 으로 먼저 설치하세요.`,
      );
    }
    const synthScript = path.join(engineDir, 'synth.py');
    if (!fs.existsSync(synthScript)) {
      throw new Error(`[${this.options.engine}] synth.py 가 없습니다: ${synthScript}`);
    }

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), `lecture-tts-${this.options.engine}-`));
    const outputPath = path.join(tmpDir, 'output.wav');

    const requestBody = JSON.stringify({
      text: request.text,
      voice: request.voice,
      outputPath,
      sampleRate: this.options.audioConfig.sampleRate,
      channels: this.options.audioConfig.channels,
      bitDepth: this.options.audioConfig.bitDepth,
      engineParams: request.engineParams,
    });

    const { command, args } = this.resolveLauncher(engineDir);

    return await new Promise<AudioGenerateResult>((resolve, reject) => {
      const child = spawn(command, args, {
        cwd: engineDir,
        env: { ...process.env, PYTHONUNBUFFERED: '1' },
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let stdoutBuf = '';
      let stderrBuf = '';
      child.stdout.on('data', chunk => {
        stdoutBuf += chunk.toString();
      });
      child.stderr.on('data', chunk => {
        const text = chunk.toString();
        stderrBuf += text;
        process.stderr.write(`[${this.options.engine}] ${text}`);
      });

      const timeoutMs = this.options.pythonTimeoutMs ?? 5 * 60 * 1000;
      const timer = setTimeout(() => {
        child.kill('SIGKILL');
        reject(new Error(`[${this.options.engine}] Python 프로세스 타임아웃 (${Math.round(timeoutMs / 1000)}초)`));
      }, timeoutMs);

      const cleanupTmp = () => {
        try {
          fs.rmSync(tmpDir, { recursive: true, force: true });
        } catch {
          /* noop */
        }
      };

      child.on('error', err => {
        clearTimeout(timer);
        cleanupTmp();
        const hint = command === 'uv'
          ? `\n힌트: uv 가 설치되어 있지 않거나 PATH 에 없을 수 있습니다. ` +
            `https://docs.astral.sh/uv/ 를 참고해 설치하거나, ${engineDir}/.venv 를 직접 생성해 주세요.`
          : '';
        reject(new Error(`[${this.options.engine}] Python 프로세스 실행 실패: ${err.message}${hint}`));
      });

      child.on('close', code => {
        clearTimeout(timer);

        if (code !== 0) {
          cleanupTmp();
          reject(new Error(
            `[${this.options.engine}] Python 프로세스 비정상 종료 (exit ${code})\n` +
            `stderr 전체 출력:\n${stderrBuf}`,
          ));
          return;
        }

        const response = this.parseResponse(stdoutBuf);
        if (!response) {
          cleanupTmp();
          reject(new Error(
            `[${this.options.engine}] stdout 에서 JSON 응답을 찾을 수 없습니다.\n` +
            `stdout:\n${stdoutBuf}\nstderr:\n${stderrBuf}`,
          ));
          return;
        }

        if (!response.ok) {
          cleanupTmp();
          reject(new Error(`[${this.options.engine}] 합성 실패: ${response.error ?? 'unknown'}`));
          return;
        }

        const audioPath = response.audioPath ?? outputPath;
        try {
          const buffer = fs.readFileSync(audioPath);
          cleanupTmp();
          resolve({
            buffer,
            durationSec: typeof response.durationSec === 'number'
              ? response.durationSec
              : this.estimateDurationFromWav(buffer),
            alignment: response.alignment ?? undefined,
          });
        } catch (err) {
          cleanupTmp();
          reject(new Error(`[${this.options.engine}] 출력 WAV 읽기 실패 (${audioPath}): ${(err as Error).message}`));
        }
      });

      child.stdin.write(requestBody);
      child.stdin.end();
    });
  }

  /**
   * 우선순위:
   * 1) tools/tts/python/{engine}/.venv/bin/python (직접 호출, uv 의존 X)
   * 2) uv run --project {engineDir} python synth.py
   *
   * .venv 가 있으면 가장 빠르고 외부 의존이 없다. 없으면 uv 가 venv 를 자동 동기화한다.
   */
  private resolveLauncher(engineDir: string): { command: string; args: string[] } {
    const venvPython = path.join(engineDir, '.venv', 'bin', 'python');
    if (fs.existsSync(venvPython)) {
      return { command: venvPython, args: ['synth.py'] };
    }
    return { command: 'uv', args: ['run', '--project', engineDir, 'python', 'synth.py'] };
  }

  /**
   * stdout 에서 마지막 JSON 라인을 응답으로 사용한다.
   * Python ML 라이브러리들이 stdout 에 진행률·경고를 찍는 경우가 있어
   * 응답 단일 라인을 보장하기보다 "마지막 JSON" 으로 파싱하는 편이 실전에서 안전하다.
   */
  private parseResponse(stdout: string): BridgeResponse | null {
    const lines = stdout.split('\n').map(l => l.trim()).filter(Boolean);
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i];
      if (line.startsWith('{') && line.endsWith('}')) {
        try {
          return JSON.parse(line) as BridgeResponse;
        } catch {
          /* try previous line */
        }
      }
    }
    return null;
  }

  private estimateDurationFromWav(buffer: Buffer): number {
    if (buffer.length < 44 || buffer.toString('ascii', 0, 4) !== 'RIFF') {
      return 0;
    }
    const sampleRate = buffer.readUInt32LE(24);
    const channels = buffer.readUInt16LE(22);
    const bitsPerSample = buffer.readUInt16LE(34);
    const dataSize = buffer.readUInt32LE(40);
    const bytesPerSec = sampleRate * channels * (bitsPerSample / 8);
    return bytesPerSec > 0 ? dataSize / bytesPerSec : 0;
  }
}
