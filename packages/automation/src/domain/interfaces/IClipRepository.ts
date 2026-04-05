export interface IClipRepository {
  existsClip(lectureId: string, sceneId: number): Promise<boolean>;
  getClipPath(lectureId: string, sceneId: number): string;
  getClipPaths(lectureId: string, sceneIds: number[]): string[];
}
