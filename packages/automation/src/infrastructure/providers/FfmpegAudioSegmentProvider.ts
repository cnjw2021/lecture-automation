import { execFile } from 'child_process';
import { randomUUID } from 'crypto';
import * as fs from 'fs-extra';
import * as os from 'os';
import * as path from 'path';
import { IAudioSegmentProvider } from '../../domain/interfaces/IAudioSegmentProvider';
import { config } from '../config';

function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile('ffmpeg', args, { maxBuffer: 1024 * 1024 * 50 }, (error, _stdout, stderr) => {
      if (error) {
        reject(new Error(`ffmpeg 실행 실패: ${stderr || error.message}`));
        return;
      }
      resolve();
    });
  });
}

export class FfmpegAudioSegmentProvider implements IAudioSegmentProvider {
  async normalizeToMonoWav(inputPath: string): Promise<string> {
    if (!await fs.pathExists(inputPath)) {
      throw new Error(`마스터 오디오 파일이 존재하지 않습니다: ${inputPath}`);
    }

    const videoAudio = config.getVideoConfig().audio;
    const tempPath = path.join(os.tmpdir(), `lecture-master-audio-${randomUUID()}.wav`);
    await runFfmpeg([
      '-y',
      '-i',
      inputPath,
      '-ar',
      String(videoAudio.sampleRate),
      '-ac',
      String(videoAudio.channels),
      '-sample_fmt',
      videoAudio.bitDepth === 16 ? 's16' : `s${videoAudio.bitDepth}`,
      tempPath,
    ]);
    return tempPath;
  }

  async cutSegment(inputPath: string, outputPath: string, startSec: number, endSec: number): Promise<void> {
    if (endSec <= startSec) {
      throw new Error(`오디오 컷 구간이 유효하지 않습니다: start=${startSec}, end=${endSec}`);
    }

    const videoAudio = config.getVideoConfig().audio;
    await fs.ensureDir(path.dirname(outputPath));
    await runFfmpeg([
      '-y',
      '-i',
      inputPath,
      '-ss',
      startSec.toFixed(3),
      '-to',
      endSec.toFixed(3),
      '-ar',
      String(videoAudio.sampleRate),
      '-ac',
      String(videoAudio.channels),
      '-sample_fmt',
      videoAudio.bitDepth === 16 ? 's16' : `s${videoAudio.bitDepth}`,
      outputPath,
    ]);
  }
}
