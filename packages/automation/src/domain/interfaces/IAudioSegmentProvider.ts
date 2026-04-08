export interface IAudioSegmentProvider {
  normalizeToMonoWav(inputPath: string): Promise<string>;
  cutSegment(inputPath: string, outputPath: string, startSec: number, endSec: number): Promise<void>;
}
