import * as path from 'path';
import * as fs from 'fs-extra';
import { IClipRepository } from '../../domain/interfaces/IClipRepository';
import { config } from '../config';

export class FileClipRepository implements IClipRepository {
  private getClipDir(lectureId: string): string {
    return path.join(config.paths.clips, lectureId);
  }

  getClipPath(lectureId: string, sceneId: number): string {
    return path.join(this.getClipDir(lectureId), `scene-${sceneId}.mp4`);
  }

  getClipPaths(lectureId: string, sceneIds: number[]): string[] {
    return sceneIds.map(id => this.getClipPath(lectureId, id));
  }

  async existsClip(lectureId: string, sceneId: number): Promise<boolean> {
    return fs.pathExists(this.getClipPath(lectureId, sceneId));
  }
}
