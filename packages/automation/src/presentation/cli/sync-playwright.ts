/**
 * sync-playwright.ts
 *
 * 이미 생성된 TTS WAV 파일을 분석해 Playwright 씬의 wait ms를 자동 재계산한다.
 * main.ts 파이프라인의 1.7단계와 동일한 SyncPlaywrightUseCase를 사용.
 *
 * 사용법:
 *   make sync-playwright LECTURE=lecture-03.json
 *   make sync-playwright LECTURE=lecture-03.json SCENE=17
 *
 * ※ TTS 오디오(WAV)가 먼저 생성되어 있어야 한다.
 *   WAV가 없으면 문자수 비례 추산으로 폴백한다.
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs-extra';
import { config } from '../../infrastructure/config';
import { FileLectureRepository } from '../../infrastructure/repositories/FileLectureRepository';
import { SyncPlaywrightUseCase } from '../../application/use-cases/SyncPlaywrightUseCase';
import { Lecture, PlaywrightVisual } from '../../domain/entities/Lecture';

dotenv.config();

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error('사용법: npx tsx sync-playwright.ts <lecture-file.json> [scene_id]');
    process.exit(1);
  }

  const jsonFileName = args[0];
  const targetSceneId = args[1] ? parseInt(args[1], 10) : undefined;

  const jsonPath = path.join(config.paths.data, jsonFileName);
  if (!fs.existsSync(jsonPath)) {
    console.error(`파일을 찾을 수 없습니다: ${jsonPath}`);
    process.exit(1);
  }

  const rawLecture: Lecture = await fs.readJson(jsonPath);

  // syncPoints가 있는 playwright 씬 목록
  const syncableScenes = rawLecture.sequence.filter(s => {
    if (s.visual.type !== 'playwright') return false;
    return ((s.visual as PlaywrightVisual).syncPoints?.length ?? 0) > 0;
  });

  if (syncableScenes.length === 0) {
    console.log('syncPoints가 정의된 playwright 씬이 없습니다.');
    console.log('\nJSON의 playwright 씬에 아래 형식으로 "syncPoints"를 추가해 주세요:\n');
    console.log(JSON.stringify({
      syncPoints: [
        { actionIndex: 4, phrase: 'パネルを表示してみましょう' },
        { actionIndex: 8, phrase: '追ってみましょう' },
      ]
    }, null, 2));
    process.exit(0);
  }

  // 특정 씬만 처리할 경우 나머지 씬의 syncPoints를 임시 제거
  const filteredLecture = targetSceneId !== undefined
    ? maskOtherScenes(rawLecture, targetSceneId)
    : rawLecture;

  const sceneLabel = targetSceneId !== undefined
    ? `씬 ${targetSceneId}`
    : `syncPoints 씬 ${syncableScenes.map(s => s.scene_id).join(', ')}`;

  console.log(`\n🎯 Playwright 싱크 시작: ${jsonFileName} (${sceneLabel})`);

  const lectureRepository = new FileLectureRepository();
  const useCase = new SyncPlaywrightUseCase(lectureRepository);
  const { updatedLecture, changedSceneIds } = await useCase.execute(filteredLecture);

  if (changedSceneIds.length === 0) {
    console.log('\n변경된 씬이 없습니다.');
    process.exit(0);
  }

  // 원본에 업데이트 씬을 병합
  const mergedSequence = rawLecture.sequence.map(scene => {
    const updated = updatedLecture.sequence.find(s => s.scene_id === scene.scene_id);
    return updated ?? scene;
  });
  const outputLecture: Lecture = { ...rawLecture, sequence: mergedSequence };

  // 백업 후 저장
  const baseName = path.basename(jsonFileName, '.json');
  const backupPath = path.join(config.paths.data, `${baseName}.sync-backup.json`);
  await fs.copy(jsonPath, backupPath);
  console.log(`\n💾 백업: ${path.relative(process.cwd(), backupPath)}`);

  await fs.writeJson(jsonPath, outputLecture, { spaces: 2 });
  console.log(`✅ 저장 완료: ${path.relative(process.cwd(), jsonPath)}`);
  console.log(`   변경된 씬: ${changedSceneIds.join(', ')}`);

  // wait 변경 내역 출력
  for (const sceneId of changedSceneIds) {
    const original = rawLecture.sequence.find(s => s.scene_id === sceneId);
    const updated = mergedSequence.find(s => s.scene_id === sceneId);
    if (!original || !updated) continue;
    printWaitDiff(sceneId, original.visual as any, updated.visual as any);
  }
}

function maskOtherScenes(lecture: Lecture, targetSceneId: number): Lecture {
  const sequence = lecture.sequence.map(s => {
    if (s.scene_id === targetSceneId) return s;
    if (s.visual.type !== 'playwright') return s;
    return { ...s, visual: { ...s.visual, syncPoints: undefined } };
  });
  return { ...lecture, sequence };
}

function printWaitDiff(sceneId: number, originalVisual: any, updatedVisual: any) {
  const orig: any[] = originalVisual.action ?? [];
  const upd: any[]  = updatedVisual.action ?? [];
  const diffs = orig
    .map((a, i) => ({ i, from: a.ms, to: upd[i]?.ms, changed: a.cmd === 'wait' && a.ms !== upd[i]?.ms }))
    .filter(d => d.changed);

  if (diffs.length === 0) return;
  console.log(`\n  [Scene ${sceneId}] wait 변경 내역:`);
  diffs.forEach(d => console.log(`    action[${d.i}]: ${d.from}ms → ${d.to}ms`));
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
