import { Lecture, PlaywrightVisual, Scene } from '../entities/Lecture';

/**
 * Playwright 라이브 데모 / 싱크 대상 판정 로직 (domain layer).
 *
 * 분산되어 있던 판정 규칙을 단일 모듈로 모은다. 사용처:
 *   - RecordVisualUseCase      (사전 녹화 대상 결정)
 *   - RunAutomationPipelineUseCase (사전 녹화 / forward sync 실행 여부)
 *   - SyncPlaywrightUseCase    (forward sync per-scene 필터)
 *   - ReverseSyncPlaywrightUseCase (역방향 싱크 대상)
 *
 * P-D 설계 상 `shared session` 씬은 offscreen action 과 공유 브라우저 컨텍스트로
 * 가변 대기를 씬 밖으로 밀어내므로, 기존 "isolated 라이브 데모 씬" 과 처리 경로가 다르다.
 * 이 모듈은 두 카테고리를 명시적으로 구분한다.
 */

const LIVE_DEMO_CMDS = new Set<string>(['wait_for', 'wait_for_claude_ready']);

function getPlaywrightVisual(scene: Scene): PlaywrightVisual | null {
  return scene.visual.type === 'playwright' ? (scene.visual as PlaywrightVisual) : null;
}

/** action 중 비결정적 대기 cmd(wait_for, wait_for_claude_ready)를 포함하는지 */
export function isLiveDemoScene(scene: Scene): boolean {
  const visual = getPlaywrightVisual(scene);
  if (!visual) return false;
  return visual.action.some(a => LIVE_DEMO_CMDS.has(a.cmd));
}

/** session.mode === 'shared' 인 Playwright 씬 */
export function isSharedSessionScene(scene: Scene): boolean {
  const visual = getPlaywrightVisual(scene);
  if (!visual) return false;
  return visual.session?.mode === 'shared';
}

/** 라이브 데모 씬이면서 공유 세션이 아닌 씬 (사전 녹화 + 역방향 싱크 대상) */
export function isIsolatedLiveDemoScene(scene: Scene): boolean {
  return isLiveDemoScene(scene) && !isSharedSessionScene(scene);
}

/**
 * 역방향 싱크 대상: isolated 라이브 데모 씬 + syncPoints 정의됨.
 * shared session 씬은 offscreen action 으로 가변 대기를 흡수하므로 역방향 싱크 불필요.
 */
export function isReverseSyncTarget(scene: Scene): boolean {
  const visual = getPlaywrightVisual(scene);
  if (!visual) return false;
  if (!isIsolatedLiveDemoScene(scene)) return false;
  return (visual.syncPoints?.length ?? 0) > 0;
}

/**
 * 순방향 싱크 대상: Playwright 씬 + syncPoints 존재.
 * isolated 라이브 데모 씬만 제외 (역방향 싱크로 처리됨).
 * shared session 씬은 offscreen 이 가변 대기를 흡수하므로 visible action 은 순방향 싱크 가능.
 */
export function isForwardSyncTarget(scene: Scene): boolean {
  const visual = getPlaywrightVisual(scene);
  if (!visual) return false;
  if (isIsolatedLiveDemoScene(scene)) return false;
  return (visual.syncPoints?.length ?? 0) > 0;
}

/**
 * 사전 녹화 대상 씬 집합 + urlFromScene 의존 체인.
 * isolated 라이브 데모 씬은 비디오를 먼저 녹화한 뒤 TTS 를 맞춰야 하므로
 * TTS 생성보다 먼저 녹화가 끝나 있어야 한다. 또한 라이브 데모 씬이
 * urlFromScene:N 을 참조하면 씬 N 도 집합에 포함 — 그래야 하위 씬이
 * 최신 conversationUrl 을 읽을 수 있다.
 */
export function computePreRecordingSceneIds(lecture: Lecture): Set<number> {
  const result = new Set<number>();
  for (const scene of lecture.sequence) {
    if (!isIsolatedLiveDemoScene(scene)) continue;
    result.add(scene.scene_id);
    const visual = getPlaywrightVisual(scene)!;
    for (const action of visual.action) {
      if (typeof action.urlFromScene === 'number') {
        result.add(action.urlFromScene);
      }
    }
  }
  return result;
}

export interface LiveDemoSessionGroup {
  sessionId: string;
  /** lecture.sequence 등장 순서 유지 */
  sceneIds: number[];
  /** 그룹 내 첫 씬의 storageState 를 대표값으로 사용 */
  storageState?: string;
}

/** 같은 session.id 를 공유하는 shared session 씬들을 하나의 그룹으로 묶는다. */
export function planLiveDemoSessions(lecture: Lecture): LiveDemoSessionGroup[] {
  const groups = new Map<string, LiveDemoSessionGroup>();
  for (const scene of lecture.sequence) {
    if (!isSharedSessionScene(scene)) continue;
    const visual = getPlaywrightVisual(scene)!;
    const sessionId = visual.session!.id;
    let group = groups.get(sessionId);
    if (!group) {
      group = { sessionId, sceneIds: [], storageState: visual.storageState };
      groups.set(sessionId, group);
    }
    group.sceneIds.push(scene.scene_id);
  }
  return Array.from(groups.values());
}
