import * as fs from 'fs-extra';
import { IAudioDurationProbe } from '../../domain/interfaces/IAudioDurationProbe';
import { readWavMetadata } from '../../domain/utils/WavAnalysisUtils';

/**
 * PCM WAV 헤더를 직접 파싱해 길이를 추출한다. ffprobe 의존성 없이 동작.
 */
export class WavAudioDurationProbe implements IAudioDurationProbe {
  async probeDurationMs(audioPath: string): Promise<number | null> {
    if (!await fs.pathExists(audioPath)) return null;
    try {
      const buffer = await fs.readFile(audioPath);
      const meta = readWavMetadata(buffer);
      return Math.round(meta.durationSec * 1000);
    } catch {
      return null;
    }
  }
}
