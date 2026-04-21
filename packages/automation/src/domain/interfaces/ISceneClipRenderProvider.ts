import { Lecture } from '../entities/Lecture';

export interface SceneClipRenderRequest {
  lectureId: string;
  sceneId: number;
  outPath: string;
  lectureData: Lecture;
  audioDurations: Record<string, number>;
}

export interface ISceneClipRenderProvider {
  renderScene(
    lectureId: string,
    sceneId: number,
    outPath: string,
    lectureData: Lecture,
    audioDurations: Record<string, number>
  ): Promise<void>;

  renderScenes?(requests: SceneClipRenderRequest[]): Promise<void>;
}
