import { Scene } from '../entities/Lecture';

export interface IVisualProvider {
  /**
   * @param lectureId  ${capture:key} placeholder 치환 및 right_click/capture 의
   *                    saveAs 저장 시 사용. 빈 문자열이면 placeholder 미사용 가정.
   */
  record(scene: Scene, outputPath: string, lectureId?: string): Promise<void>;
}
