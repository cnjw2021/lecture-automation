export interface IScreenshotProvider {
  capture(url: string, outputPath: string, waitMs?: number): Promise<void>;
}
