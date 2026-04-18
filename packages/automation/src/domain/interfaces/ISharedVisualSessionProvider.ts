import { Scene } from '../entities/Lecture';
import { SceneManifest } from '../entities/StepManifest';

/**
 * 공유 브라우저 세션(P-D) 단위의 Playwright 캡처 프로바이더.
 *
 * 기존 IStateCaptureProvider(씬 단위)와 달리 "세션 → 씬 N개" 계층을 갖는다.
 *
 * 세션 생명주기:
 *   openSession  → browser/context/page 1개 오픈
 *   captureSceneInSession × N → 같은 page 위에서 씬별 자산 캡처
 *   closeSession → 컨텍스트/브라우저 종료
 *
 * 이 인터페이스의 존재 이유:
 *   - LLM 응답처럼 가변적인 대기를 **씬 바깥(offscreen)**에서 처리하고,
 *   - 결과 확인 씬이 "이전 씬의 page 상태를 그대로 이어받아 시작"하도록 보장한다.
 */
export interface LiveDemoSessionPlan {
  lectureId: string;
  sessionId: string;
  storageState?: string;
  sceneIds: number[];
}

export interface SharedVisualSessionHandle {
  sessionId: string;
}

export interface ISharedVisualSessionProvider {
  openSession(plan: LiveDemoSessionPlan): Promise<SharedVisualSessionHandle>;
  captureSceneInSession(
    handle: SharedVisualSessionHandle,
    scene: Scene,
    outputDir: string,
  ): Promise<SceneManifest | null>;
  closeSession(handle: SharedVisualSessionHandle): Promise<void>;
}
