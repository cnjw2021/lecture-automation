/**
 * ReverseSyncPlaywrightUseCase
 *
 * 라이브 데모 Playwright 씬(wait_for 포함)의 역방향 싱크를 수행한다.
 *
 * 일반 싱크(SyncPlaywrightUseCase)가 "TTS 오디오에 맞춰 비디오 wait를 조정"하는 반면,
 * 역방향 싱크는 "비디오 녹화 타임스탬프에 맞춰 TTS 오디오에 무음을 삽입"한다.
 *
 * 알고리즘:
 *   1. 녹화 매니페스트에서 syncPoint 대상 액션의 완료 시점(endMs) 취득
 *   2. TTS WAV에서 syncPoint phrase의 발화 시점 취득 (기존 WAV 분석 재사용)
 *   3. 각 syncPoint에 대해: 비디오 시점 - 오디오 시점 = 삽입할 무음 길이
 *   4. WAV PCM을 phrase 위치에서 분할, 무음 삽입 후 재조립
 *   5. 조정된 WAV를 원본 파일에 덮어쓰기
 */

import * as fs from 'fs-extra';
import { Lecture, PlaywrightVisual, PlaywrightSyncPoint } from '../../domain/entities/Lecture';
import { ILectureRepository } from '../../domain/interfaces/ILectureRepository';
import { readWavMetadata, insertSilenceIntoWav } from '../../domain/utils/WavAnalysisUtils';
import { RecordingManifest } from '../../infrastructure/providers/PlaywrightVisualProvider';

export class ReverseSyncPlaywrightUseCase {
  constructor(private readonly lectureRepository: ILectureRepository) {}

  async execute(lecture: Lecture): Promise<{ adjustedSceneIds: number[] }> {
    const adjustedSceneIds: number[] = [];

    for (const scene of lecture.sequence) {
      if (scene.visual.type !== 'playwright') continue;
      const visual = scene.visual as PlaywrightVisual;

      // 라이브 데모 씬 판별: wait_for가 action에 있고 syncPoints가 정의된 경우
      const hasWaitFor = visual.action.some(a => a.cmd === 'wait_for');
      if (!hasWaitFor || !visual.syncPoints?.length) continue;

      console.log(`\n[ReverseSync] Scene ${scene.scene_id} 처리 중...`);

      try {
        await this.reverseSyncScene(lecture.lecture_id, scene.scene_id, scene.narration, visual);
        adjustedSceneIds.push(scene.scene_id);
      } catch (err) {
        console.error(`  ❌ Scene ${scene.scene_id} 역방향 싱크 실패:`, (err as Error).message);
      }
    }

    return { adjustedSceneIds };
  }

  private async reverseSyncScene(
    lectureId: string,
    sceneId: number,
    narration: string,
    visual: PlaywrightVisual,
  ): Promise<void> {
    // 1. 매니페스트 읽기
    const capturePath = this.lectureRepository.getCapturePath(lectureId, sceneId);
    const manifestPath = capturePath.replace(/\.\w+$/, '.manifest.json');

    if (!await fs.pathExists(manifestPath)) {
      throw new Error(`녹화 매니페스트 없음: ${manifestPath}`);
    }
    const manifest: RecordingManifest = await fs.readJson(manifestPath);

    // 2. TTS WAV 읽기 + phrase 타이밍 분석
    const wavPath = this.lectureRepository.getAudioPath(lectureId, sceneId);
    if (!await fs.pathExists(wavPath)) {
      throw new Error(`TTS WAV 없음: ${wavPath}`);
    }
    const wavBuffer = await fs.readFile(wavPath);
    const wavMeta = readWavMetadata(wavBuffer);
    const wavTotalMs = Math.round(wavMeta.durationSec * 1000);

    // 3. 각 syncPoint에 대해 무음 삽입량 계산
    const sortedSyncPoints = [...visual.syncPoints!].sort((a, b) => a.actionIndex - b.actionIndex);
    const insertions: { splitMs: number; silenceMs: number }[] = [];

    for (const sp of sortedSyncPoints) {
      // 비디오에서의 타겟 시점: 해당 액션의 완료(endMs)
      const actionTs = manifest.actionTimestamps.find(t => t.index === sp.actionIndex);
      if (!actionTs) {
        console.warn(`  ⚠️ action[${sp.actionIndex}] 타임스탬프 없음, 건너뜀`);
        continue;
      }
      const videoTargetMs = actionTs.endMs;

      // 오디오에서의 현재 발화 시점
      const audioCurrentMs = this.estimatePhraseMs(sp.phrase, narration, wavTotalMs);
      if (audioCurrentMs === null) {
        console.warn(`  ⚠️ phrase "${sp.phrase.slice(0, 20)}" 위치 특정 실패, 건너뜀`);
        continue;
      }

      // 이전 삽입들로 인한 누적 오프셋 반영
      const cumulativeSilence = insertions.reduce((sum, ins) => sum + ins.silenceMs, 0);
      const adjustedAudioMs = audioCurrentMs + cumulativeSilence;
      const silenceMs = videoTargetMs - adjustedAudioMs;

      if (silenceMs <= 0) {
        console.log(`  action[${sp.actionIndex}] "${sp.phrase.slice(0, 16)}...": 무음 불필요 (video=${videoTargetMs}ms, audio=${adjustedAudioMs}ms)`);
        continue;
      }

      console.log(`  action[${sp.actionIndex}] "${sp.phrase.slice(0, 16)}...": ${Math.round(silenceMs)}ms 무음 삽입 (video=${videoTargetMs}ms, audio=${adjustedAudioMs}ms)`);
      insertions.push({
        splitMs: audioCurrentMs + cumulativeSilence,
        silenceMs: Math.round(silenceMs),
      });
    }

    if (insertions.length === 0) {
      console.log('  삽입할 무음 없음');
      return;
    }

    // 4. WAV에 무음 삽입
    const adjustedWav = insertSilenceIntoWav(wavBuffer, insertions);
    const adjustedMeta = readWavMetadata(adjustedWav);
    const newDurationMs = Math.round(adjustedMeta.durationSec * 1000);

    console.log(`  WAV 조정 완료: ${wavTotalMs}ms → ${newDurationMs}ms`);

    // 5. 원본 WAV 덮어쓰기
    await fs.writeFile(wavPath, adjustedWav);
    console.log(`  ✅ 조정된 WAV 저장: ${wavPath}`);
  }

  /**
   * 나레이션 내 phrase의 발화 시점을 문자 수 비례로 추정.
   * SyncPlaywrightUseCase의 WAV 묵음 분석보다 단순하지만,
   * 역방향 싱크에서는 정밀도보다 안정성이 중요하므로 문자 수 추정 사용.
   */
  private estimatePhraseMs(phrase: string, narration: string, totalMs: number): number | null {
    const pos = narration.indexOf(phrase);
    if (pos === -1) return null;
    return Math.round((pos / narration.length) * totalMs);
  }
}
