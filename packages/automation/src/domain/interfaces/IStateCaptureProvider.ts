import { Scene } from '../entities/Lecture';
import { SceneManifest } from '../entities/StepManifest';

export interface IStateCaptureProvider {
  /**
   * @param lectureId  ${capture:key} placeholder 치환 시 캡처 저장소 디렉터리
   *                   (tmp/playwright-captures/{lectureId}/) 의 키. 빈 문자열이면 placeholder 미사용 가정.
   */
  capture(scene: Scene, outputDir: string, lectureId?: string): Promise<SceneManifest | null>;
}
