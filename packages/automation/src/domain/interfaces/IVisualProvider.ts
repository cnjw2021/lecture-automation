import { Scene } from '../entities/Lecture';

export interface IVisualProvider {
  record(scene: Scene, outputPath: string): Promise<void>;
}
