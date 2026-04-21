import { Lecture, Scene } from '../entities/Lecture';

export function findSceneById(lecture: Lecture, sceneId: number): Scene {
  const scene = lecture.sequence.find(item => item.scene_id === sceneId);
  if (!scene) {
    throw new Error(`Scene ${sceneId}을 lecture data에서 찾을 수 없습니다.`);
  }
  return scene;
}
