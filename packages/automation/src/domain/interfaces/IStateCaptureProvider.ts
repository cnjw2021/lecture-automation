import { Scene } from '../entities/Lecture';
import { SceneManifest } from '../entities/StepManifest';

export interface IStateCaptureProvider {
  capture(scene: Scene, outputDir: string): Promise<SceneManifest | null>;
}
