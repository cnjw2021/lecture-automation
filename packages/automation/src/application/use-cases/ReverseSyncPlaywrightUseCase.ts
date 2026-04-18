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
 *   2. alignment JSON이 있으면 문자 단위 정밀 타이밍, 없으면 WAV 묵음 분석 폴백
 *   3. 각 syncPoint에 대해: 비디오 시점 - 오디오 시점 = 삽입할 무음 길이
 *   4. WAV PCM을 phrase 위치에서 분할, 무음 삽입 후 재조립
 *   5. 조정된 WAV를 원본 파일에 덮어쓰기
 */

import * as fs from 'fs-extra';
import { Lecture, PlaywrightVisual, PlaywrightSyncPoint } from '../../domain/entities/Lecture';
import { AudioAlignment } from '../../domain/interfaces/IAudioProvider';
import { ILectureRepository } from '../../domain/interfaces/ILectureRepository';
import { isReverseSyncTarget } from '../../domain/policies/LiveDemoScenePolicy';
import { readWavMetadata, insertSilenceIntoWav } from '../../domain/utils/WavAnalysisUtils';
import { RecordingManifest } from '../../infrastructure/providers/PlaywrightVisualProvider';

/**
 * 액션 cmd별 기본 sync target.
 * 'start': 시각 효과가 액션 시작 순간에 발생하는 액션 (press/click/scroll 등)
 * 'end'  : 조건 충족·시간 경과 후 시각 효과가 발생하는 액션 (wait_for/wait)
 */
const DEFAULT_SYNC_TARGET: Record<string, 'start' | 'end'> = {
  wait_for: 'end',
  wait: 'end',
};

function resolveSyncTarget(cmd: string, override?: 'start' | 'end'): 'start' | 'end' {
  if (override) return override;
  return DEFAULT_SYNC_TARGET[cmd] ?? 'start';
}

export class ReverseSyncPlaywrightUseCase {
  constructor(private readonly lectureRepository: ILectureRepository) {}

  async execute(lecture: Lecture, options: { sceneIds?: number[] } = {}): Promise<{ adjustedSceneIds: number[] }> {
    const adjustedSceneIds: number[] = [];
    const targetSceneIds = options.sceneIds;

    for (const scene of lecture.sequence) {
      if (targetSceneIds && !targetSceneIds.includes(scene.scene_id)) continue;
      if (!isReverseSyncTarget(scene)) continue;
      const visual = scene.visual as PlaywrightVisual;

      console.log(`\n[ReverseSync] Scene ${scene.scene_id} 처리 중...`);

      try {
        await this.reverseSyncScene(lecture.lecture_id, scene.scene_id, scene.narration, visual);
        adjustedSceneIds.push(scene.scene_id);
      } catch (err) {
        console.error(`  ❌ Scene ${scene.scene_id} 역방향 싱크 실패:`, (err as Error).message);
      }
    }

    // 조정된 씬의 duration 메타데이터 갱신 (클립 렌더링 시 조정된 WAV 길이 사용)
    if (adjustedSceneIds.length > 0) {
      const existingDurations = await this.lectureRepository.getAudioDurations(lecture.lecture_id) || {};
      for (const sceneId of adjustedSceneIds) {
        const newDuration = await this.lectureRepository.getAudioDuration(lecture.lecture_id, sceneId);
        if (newDuration !== null) {
          existingDurations[sceneId.toString()] = newDuration;
          console.log(`  📏 Scene ${sceneId} duration 갱신: ${newDuration.toFixed(2)}초`);
        }
      }
      await this.lectureRepository.saveAudioDurations(lecture.lecture_id, existingDurations);
      console.log(`  ✅ durations.json 갱신 완료`);
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

    // 2. TTS WAV 읽기
    const wavPath = this.lectureRepository.getAudioPath(lectureId, sceneId);
    if (!await fs.pathExists(wavPath)) {
      throw new Error(`TTS WAV 없음: ${wavPath}`);
    }
    const wavBuffer = await fs.readFile(wavPath);
    const wavMeta = readWavMetadata(wavBuffer);
    const wavTotalMs = Math.round(wavMeta.durationSec * 1000);

    // 3. alignment 로드 (문자 단위 타임스탬프)
    const alignment = await this.lectureRepository.getAlignment(lectureId, sceneId);
    if (alignment) {
      console.log(`  alignment 로드 완료 (${alignment.characters.length}자, 문자 단위 정밀 싱크)`);
    } else {
      console.log('  ⚠️ alignment 없음 — 문자 비례 추정 폴백 사용');
    }

    // 4. 각 syncPoint에 대해 무음 삽입량 계산
    const sortedSyncPoints = [...visual.syncPoints!].sort((a, b) => a.actionIndex - b.actionIndex);
    const insertions: { splitMs: number; silenceMs: number }[] = [];

    for (const sp of sortedSyncPoints) {
      // 비디오에서의 타겟 시점: 액션 cmd 타입에 따라 startMs 또는 endMs 선택 (syncPoint.target로 오버라이드 가능)
      const actionTs = manifest.actionTimestamps.find(t => t.index === sp.actionIndex);
      if (!actionTs) {
        console.warn(`  ⚠️ action[${sp.actionIndex}] 타임스탬프 없음, 건너뜀`);
        continue;
      }
      const targetKind = resolveSyncTarget(actionTs.cmd, sp.target);
      const videoTargetMs = targetKind === 'start' ? actionTs.startMs : actionTs.endMs;

      // 오디오에서의 현재 발화 시점
      const audioCurrentMs = alignment
        ? this.getPhraseMsFromAlignment(sp.phrase, narration, alignment)
        : this.estimatePhraseMs(sp.phrase, narration, wavTotalMs);

      if (audioCurrentMs === null) {
        console.warn(`  ⚠️ phrase "${sp.phrase.slice(0, 20)}" 위치 특정 실패, 건너뜀`);
        continue;
      }

      // 이전 삽입들로 인한 누적 오프셋 반영
      const cumulativeSilence = insertions.reduce((sum, ins) => sum + ins.silenceMs, 0);
      const adjustedAudioMs = audioCurrentMs + cumulativeSilence;
      const silenceMs = videoTargetMs - adjustedAudioMs;

      if (silenceMs <= 0) {
        console.log(`  action[${sp.actionIndex}] (${actionTs.cmd}/${targetKind}) "${sp.phrase.slice(0, 16)}...": 무음 불필요 (video=${videoTargetMs}ms, audio=${adjustedAudioMs}ms)`);
        continue;
      }

      console.log(`  action[${sp.actionIndex}] (${actionTs.cmd}/${targetKind}) "${sp.phrase.slice(0, 16)}...": ${Math.round(silenceMs)}ms 무음 삽입 (video=${videoTargetMs}ms, audio=${adjustedAudioMs}ms)`);
      insertions.push({
        splitMs: audioCurrentMs,
        silenceMs: Math.round(silenceMs),
      });
    }

    if (insertions.length === 0) {
      console.log('  삽입할 무음 없음');
      return;
    }

    // 5. WAV에 무음 삽입
    const adjustedWav = insertSilenceIntoWav(wavBuffer, insertions);
    const adjustedMeta = readWavMetadata(adjustedWav);
    const newDurationMs = Math.round(adjustedMeta.durationSec * 1000);

    console.log(`  WAV 조정 완료: ${wavTotalMs}ms → ${newDurationMs}ms`);

    // 6. 원본 WAV 덮어쓰기
    await fs.writeFile(wavPath, adjustedWav);
    console.log(`  ✅ 조정된 WAV 저장: ${wavPath}`);
  }

  /**
   * alignment 데이터에서 phrase의 정확한 발화 시점(ms)을 반환.
   * narration 텍스트에서 phrase의 문자 위치를 찾고,
   * alignment의 character_start_times_seconds에서 해당 인덱스의 시작 시각을 가져온다.
   */
  private getPhraseMsFromAlignment(
    phrase: string,
    narration: string,
    alignment: AudioAlignment,
  ): number | null {
    const pos = narration.indexOf(phrase);
    if (pos === -1) return null;

    // alignment 문자 배열과 narration 문자열의 매핑
    // ElevenLabs alignment.characters는 narration의 각 문자에 대응
    if (pos < alignment.character_start_times_seconds.length) {
      const startSec = alignment.character_start_times_seconds[pos];
      return Math.round(startSec * 1000);
    }

    // alignment 길이가 부족한 경우 (예외적) — 마지막 타임스탬프 기준 보간
    console.warn(`  ⚠️ alignment 인덱스 초과 (pos=${pos}, len=${alignment.character_start_times_seconds.length})`);
    return null;
  }

  /**
   * 폴백: 나레이션 내 phrase의 발화 시점을 문자 수 비례로 추정.
   * alignment가 없는 TTS 프로바이더용.
   */
  private estimatePhraseMs(phrase: string, narration: string, totalMs: number): number | null {
    const pos = narration.indexOf(phrase);
    if (pos === -1) return null;
    return Math.round((pos / narration.length) * totalMs);
  }
}
