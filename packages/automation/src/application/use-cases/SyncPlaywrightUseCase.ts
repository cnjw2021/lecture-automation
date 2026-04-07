import { Lecture, Scene, PlaywrightVisual, PlaywrightAction, PlaywrightSyncPoint } from '../../domain/entities/Lecture';
import { GoogleCloudTtsProvider, PhraseTiming } from '../../infrastructure/providers/GoogleCloudTtsProvider';

// 각 action cmd의 고정 소요시간 추정치 (ms)
// wait는 조정 가능하므로 포함하지 않는다.
const FIXED_ACTION_DURATION_MS: Partial<Record<string, number>> = {
  goto: 7000,        // Yahoo Japan 등 무거운 사이트 기준 (일반 사이트는 ~3000)
  mouse_move: 0,
  click: 500,
  type: 0,           // 텍스트 길이에 따라 다르지만 일단 0
  press: 100,
  focus: 100,
  mouse_drag: 1000,
  highlight: 1500,   // 자동 종료까지 1.5초
  open_devtools: 250,
  disable_css: 0,
  enable_css: 0,
};

/**
 * 씬별 Playwright syncPoints와 TTS 타이밍을 사용해 wait ms를 자동 재계산한다.
 */
export class SyncPlaywrightUseCase {
  constructor(private readonly ttsProvider: GoogleCloudTtsProvider) {}

  /**
   * 강의 전체를 처리. 변경된 씬 목록을 返す.
   * 원본 lecture 객체를 직접 변경하지 않고 깊은 복사본을 返す.
   */
  async execute(lecture: Lecture): Promise<{ updatedLecture: Lecture; changedSceneIds: number[] }> {
    const updatedSequence = lecture.sequence.map(scene => ({ ...scene, visual: { ...scene.visual } }));
    const changedSceneIds: number[] = [];

    for (let i = 0; i < updatedSequence.length; i++) {
      const scene = updatedSequence[i];
      if (scene.visual.type !== 'playwright') continue;
      const visual = scene.visual as PlaywrightVisual;
      if (!visual.syncPoints || visual.syncPoints.length === 0) continue;

      console.log(`\n[Sync] Scene ${scene.scene_id} 처리 중...`);

      try {
        const updatedActions = await this.syncScene(scene, visual);
        updatedSequence[i] = {
          ...scene,
          visual: { ...visual, action: updatedActions },
        };
        changedSceneIds.push(scene.scene_id);
      } catch (err) {
        console.error(`  ❌ Scene ${scene.scene_id} 싱크 실패:`, (err as Error).message);
      }
    }

    return {
      updatedLecture: { ...lecture, sequence: updatedSequence },
      changedSceneIds,
    };
  }

  private async syncScene(scene: Scene, visual: PlaywrightVisual): Promise<PlaywrightAction[]> {
    const { syncPoints, action: actions } = visual;
    if (!syncPoints || syncPoints.length === 0) return actions;

    // 1. TTS 타이밍 취득
    const { durationSec, timings } = await this.ttsProvider.generateWithTimings(
      scene.narration,
      syncPoints,
      { scene_id: scene.scene_id }
    );

    const totalMs = durationSec * 1000;

    // 2. syncPoints를 actionIndex 오름차순으로 정렬
    const sortedSyncPoints = [...syncPoints].sort((a, b) => a.actionIndex - b.actionIndex);

    // 3. 각 syncPoint의 타겟 발화 시각 결정
    //    타이밍 취득 실패한 것은 문자수 비례 추산으로 補完
    const targetFirings = computeTargetFirings(
      scene.narration,
      sortedSyncPoints,
      timings,
      totalMs
    );

    // 4. 세그먼트별 wait 재계산
    const segments = buildSegments(sortedSyncPoints, actions.length);
    const updatedActions = [...actions];

    for (let si = 0; si < segments.length; si++) {
      const { from, to } = segments[si];
      // 세그먼트 [from, to) 구간의 actions
      const segmentActions = actions.slice(from, to);

      // 세그먼트 target duration
      const segStartMs = si === 0 ? 0 : targetFirings[si - 1].targetMs;
      const segEndMs = si < targetFirings.length ? targetFirings[si].targetMs : totalMs;
      const targetSegDurationMs = segEndMs - segStartMs;

      if (targetSegDurationMs <= 0) {
        console.warn(`  ⚠️ 세그먼트 ${si}: targetDuration=${targetSegDurationMs}ms ≤ 0, 건너뜁니다.`);
        continue;
      }

      // 세그먼트 내 고정 소요시간과 wait 목록 파악
      const waitIndices: number[] = [];
      let fixedMs = 0;
      for (let j = from; j < to; j++) {
        const cmd = actions[j].cmd;
        if (cmd === 'wait') {
          waitIndices.push(j);
        } else {
          fixedMs += FIXED_ACTION_DURATION_MS[cmd] ?? 0;
        }
      }

      if (waitIndices.length === 0) {
        console.warn(`  ⚠️ 세그먼트 ${si} (actions ${from}~${to - 1}): wait 액션 없음, 조정 불가`);
        continue;
      }

      const availableMs = targetSegDurationMs - fixedMs;
      if (availableMs < 0) {
        console.warn(`  ⚠️ 세그먼트 ${si}: 고정 소요(${fixedMs}ms) > 목표(${targetSegDurationMs}ms). 최소 0으로 설정.`);
      }

      // 기존 wait 합계에서 비례 분배
      const currentWaitTotal = waitIndices.reduce((sum, idx) => sum + (actions[idx].ms ?? 0), 0);

      for (const idx of waitIndices) {
        const originalMs = actions[idx].ms ?? 0;
        const ratio = currentWaitTotal > 0 ? originalMs / currentWaitTotal : 1 / waitIndices.length;
        const newMs = Math.max(0, Math.round(availableMs * ratio));
        updatedActions[idx] = { ...actions[idx], ms: newMs };
      }

      const newWaitTotal = waitIndices.reduce((sum, idx) => sum + (updatedActions[idx].ms ?? 0), 0);
      console.log(
        `  세그먼트 ${si} (actions ${from}~${to - 1}): ` +
        `목표 ${targetSegDurationMs}ms, 고정 ${fixedMs}ms, wait ${currentWaitTotal}→${newWaitTotal}ms`
      );
    }

    return updatedActions;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface TargetFiring {
  actionIndex: number;
  targetMs: number;
}

/**
 * 각 syncPoint의 타겟 발화 시각을 TTS timing 또는 문자수 추산으로 결정한다.
 */
function computeTargetFirings(
  narration: string,
  syncPoints: PlaywrightSyncPoint[],
  timings: PhraseTiming[],
  totalMs: number
): TargetFiring[] {
  const totalChars = narration.length;

  return syncPoints.map(sp => {
    const timing = timings.find(t => t.actionIndex === sp.actionIndex);
    if (timing) {
      return { actionIndex: sp.actionIndex, targetMs: timing.startMs };
    }
    // 폴백: 문자수 비례
    const pos = narration.indexOf(sp.phrase);
    const estimatedMs = pos !== -1 ? Math.round((pos / totalChars) * totalMs) : 0;
    console.warn(`  [추산] action[${sp.actionIndex}]: ${estimatedMs}ms (TTS 타이밍 미취득)`);
    return { actionIndex: sp.actionIndex, targetMs: estimatedMs };
  });
}

/**
 * syncPoints의 actionIndex를 경계로 actions를 세그먼트로 나눈다.
 * 각 세그먼트 [from, to)에서:
 *   - to = 다음 syncPoint의 actionIndex (또는 actions 끝)
 *   - from = 이전 세그먼트의 to
 *
 * 예: syncPoints[0].actionIndex=0, syncPoints[1].actionIndex=4
 *   → segments: [{from:0, to:4}, {from:4, to:...}]
 *
 * ※ 첫 syncPoint부터 시작; 0이 아닌 경우 앞 actions는 무조건 첫 세그먼트에 포함.
 */
function buildSegments(sortedSyncPoints: PlaywrightSyncPoint[], totalActions: number): { from: number; to: number }[] {
  const boundaries = sortedSyncPoints.map(sp => sp.actionIndex);
  boundaries.push(totalActions); // sentinel

  const segments: { from: number; to: number }[] = [];
  let from = 0;
  for (const boundary of boundaries) {
    if (boundary > from) {
      segments.push({ from, to: boundary });
    } else if (boundary === from && segments.length === 0) {
      // 첫 syncPoint가 0번 action인 경우 - 세그먼트는 0부터 다음 경계까지
      continue;
    }
    from = boundary;
  }
  // 마지막 segment: 마지막 syncPoint ~ 끝
  if (from < totalActions) {
    segments.push({ from, to: totalActions });
  }
  return segments;
}
