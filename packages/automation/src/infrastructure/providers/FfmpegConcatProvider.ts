import { exec } from 'child_process';
import * as path from 'path';
import * as fs from 'fs-extra';
import * as os from 'os';
import { IConcatProvider } from '../../domain/interfaces/IConcatProvider';

export class FfmpegConcatProvider implements IConcatProvider {
  async concat(clipPaths: string[], outputPath: string): Promise<void> {
    await fs.ensureDir(path.dirname(outputPath));

    for (const clipPath of clipPaths) {
      if (!await fs.pathExists(clipPath)) {
        throw new Error(`클립 파일이 존재하지 않습니다: ${clipPath}\n누락된 씬을 먼저 렌더링해 주세요.`);
      }
    }

    const listPath = path.join(os.tmpdir(), `lecture-concat-${Date.now()}.txt`);
    const listContent = clipPaths.map(p => `file '${p}'`).join('\n');
    await fs.writeFile(listPath, listContent, 'utf8');

    const command = `ffmpeg -y -f concat -safe 0 -i "${listPath}" -c copy -fflags +genpts "${outputPath}"`;

    return new Promise((resolve, reject) => {
      exec(command, { maxBuffer: 1024 * 1024 * 50 }, (error, _stdout, stderr) => {
        fs.removeSync(listPath);
        if (error) {
          console.error('ffmpeg concat 오류:', stderr);
          return reject(error);
        }
        resolve();
      });
    });
  }
}
