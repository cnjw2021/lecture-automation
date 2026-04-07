/**
 * sync-playwright.ts
 *
 * Playwright 씬의 narration-action 싱크를 자동으로 맞춘다.
 *
 * 사용법:
 *   npx tsx packages/automation/src/presentation/cli/sync-playwright.ts <lecture-file.json>
 *   npx tsx packages/automation/src/presentation/cli/sync-playwright.ts <lecture-file.json> <scene_id>
 *
 * 예:
 *   npx tsx ... sync-playwright.ts lecture-03.json
 *   npx tsx ... sync-playwright.ts lecture-03.json 17
 *
 * 동작:
 *   1. data/<lecture-file.json> 읽기
 *   2. syncPoints가 정의된 playwright 씬을 탐색
 *   3. Google Cloud TTS v1beta1로 SSML mark 타이밍 취득
 *   4. wait ms 자동 재계산
 *   5. 원본 JSON을 덮어쓰기 (백업: data/<name>.sync-backup.json)
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs-extra';
import { config } from '../../infrastructure/config';
import { GoogleCloudTtsProvider } from '../../infrastructure/providers/GoogleCloudTtsProvider';
import { SyncPlaywrightUseCase } from '../../application/use-cases/SyncPlaywrightUseCase';
import { Lecture } from '../../domain/entities/Lecture';

dotenv.config();

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error('사용법: npx tsx sync-playwright.ts <lecture-file.json> [scene_id]');
    process.exit(1);
  }

  const jsonFileName = args[0];
  const targetSceneId = args[1] ? parseInt(args[1], 10) : undefined;

  const dataDir = config.paths.data;
  const jsonPath = path.join(dataDir, jsonFileName);

  if (!fs.existsSync(jsonPath)) {
    console.error(`파일을 찾을 수 없습니다: ${jsonPath}`);
    process.exit(1);
  }

  // Google Cloud TTS 프로바이더 생성
  const gcConfig = config.providers.google_cloud_tts;
  if (!gcConfig.keyFilePath) {
    console.error('GOOGLE_CLOUD_TTS_KEY_FILE 환경 변수가 설정되지 않았습니다.');
    process.exit(1);
  }

  const videoConfig = config.getVideoConfig();
  const ttsConfig = config.getTtsConfig();
  const audioConfig = {
    sampleRate: videoConfig.audio.sampleRate,
    channels: videoConfig.audio.channels,
    bitDepth: videoConfig.audio.bitDepth,
    speechRate: ttsConfig.speechRate ?? 1.0,
  };

  const ttsProvider = new GoogleCloudTtsProvider(
    gcConfig.keyFilePath,
    gcConfig.voiceName,
    gcConfig.languageCode,
    audioConfig
  );

  // 강의 JSON 로드
  const rawLecture: Lecture = await fs.readJson(jsonPath);

  // 특정 씬만 처리할 경우 syncPoints가 없는 다른 씬은 통과시킨다
  if (targetSceneId !== undefined) {
    const targetScene = rawLecture.sequence.find(s => s.scene_id === targetSceneId);
    if (!targetScene) {
      console.error(`Scene ${targetSceneId}를 찾을 수 없습니다.`);
      process.exit(1);
    }
    if (targetScene.visual.type !== 'playwright') {
      console.error(`Scene ${targetSceneId}는 playwright 씬이 아닙니다.`);
      process.exit(1);
    }
    const visual = targetScene.visual as any;
    if (!visual.syncPoints || visual.syncPoints.length === 0) {
      console.error(`Scene ${targetSceneId}에 syncPoints가 없습니다. JSON에 syncPoints를 먼저 정의해 주세요.`);
      process.exit(1);
    }
  }

  // syncPoints가 있는 playwright 씬 목록 표시
  const syncableScenes = rawLecture.sequence.filter(s => {
    if (s.visual.type !== 'playwright') return false;
    const v = s.visual as any;
    return v.syncPoints && v.syncPoints.length > 0;
  });

  if (syncableScenes.length === 0) {
    console.log('syncPoints가 정의된 playwright 씬이 없습니다.');
    console.log('JSON의 playwright 씬에 "syncPoints" 필드를 추가해 주세요.\n');
    console.log('예시:');
    console.log(JSON.stringify({
      syncPoints: [
        { actionIndex: 0, phrase: 'アクセスしてみます' },
        { actionIndex: 4, phrase: 'パネルを表示してみましょう' },
      ]
    }, null, 2));
    process.exit(0);
  }

  const filteredLecture = targetSceneId !== undefined
    ? filterToSingleScene(rawLecture, targetSceneId)
    : rawLecture;

  console.log(`\n📡 Playwright 싱크 시작: ${jsonFileName}`);
  if (targetSceneId !== undefined) {
    console.log(`   対象씬: ${targetSceneId}`);
  } else {
    console.log(`   syncPoints 씬 수: ${syncableScenes.length}개 (Scene ${syncableScenes.map(s => s.scene_id).join(', ')})`);
  }

  const useCase = new SyncPlaywrightUseCase(ttsProvider);
  const { updatedLecture, changedSceneIds } = await useCase.execute(filteredLecture);

  if (changedSceneIds.length === 0) {
    console.log('\n변경된 씬이 없습니다.');
    process.exit(0);
  }

  // 원본 씬을 updatedLecture의 씬으로 병합
  const mergedSequence = rawLecture.sequence.map(scene => {
    const updated = updatedLecture.sequence.find(s => s.scene_id === scene.scene_id);
    return updated ?? scene;
  });

  const outputLecture: Lecture = { ...rawLecture, sequence: mergedSequence };

  // 백업
  const baseName = path.basename(jsonFileName, '.json');
  const backupPath = path.join(dataDir, `${baseName}.sync-backup.json`);
  await fs.copy(jsonPath, backupPath);
  console.log(`\n💾 백업: ${path.relative(process.cwd(), backupPath)}`);

  // 저장
  await fs.writeJson(jsonPath, outputLecture, { spaces: 2 });
  console.log(`✅ 저장 완료: ${path.relative(process.cwd(), jsonPath)}`);
  console.log(`   변경된 씬: ${changedSceneIds.join(', ')}`);

  // diff 요약 출력
  for (const sceneId of changedSceneIds) {
    const original = rawLecture.sequence.find(s => s.scene_id === sceneId);
    const updated = mergedSequence.find(s => s.scene_id === sceneId);
    if (!original || !updated) continue;
    printWaitDiff(sceneId, original.visual as any, updated.visual as any);
  }
}

function filterToSingleScene(lecture: Lecture, sceneId: number): Lecture {
  // 싱크 대상 씬만 남기되 lecture 구조는 유지
  const sequence = lecture.sequence.map(s => {
    if (s.scene_id !== sceneId) {
      // syncPoints 없는 것으로 처리 (SyncPlaywrightUseCase가 스킵)
      const visual = s.visual.type === 'playwright'
        ? { ...s.visual, syncPoints: undefined }
        : s.visual;
      return { ...s, visual };
    }
    return s;
  });
  return { ...lecture, sequence };
}

function printWaitDiff(sceneId: number, originalVisual: any, updatedVisual: any) {
  console.log(`\n  [Scene ${sceneId}] wait 변경 내역:`);
  const orig: any[] = originalVisual.action ?? [];
  const upd: any[] = updatedVisual.action ?? [];
  for (let i = 0; i < orig.length; i++) {
    if (orig[i].cmd === 'wait' && orig[i].ms !== upd[i]?.ms) {
      console.log(`    action[${i}]: ${orig[i].ms}ms → ${upd[i]?.ms}ms`);
    }
  }
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
