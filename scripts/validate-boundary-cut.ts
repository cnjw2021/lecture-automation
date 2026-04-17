/**
 * 새 경계 컷 알고리즘 검증 스크립트
 *
 * 기존 청크 디버그 산출물을 읽어, 새 알고리즘으로 cut 을 재계산하고
 * 이전 결과와 양방향 leak 을 비교한다:
 *   - tail leak: appliedCutMs < prevSpeechEndMs  (N 의 마지막 발화 절단)
 *   - head leak: appliedCutMs > nextSpeechStartMs (N+1 의 선두 발화 절단)
 *
 * **WAV를 새로 쓰지 않음** — 진단만 출력. leak 잔존 시 exit 1.
 *
 * 사용법:
 *   npx tsx scripts/validate-boundary-cut.ts <lecture.json>
 */
import * as fs from 'fs-extra';
import * as path from 'path';
import { config } from '../packages/automation/src/infrastructure/config';
import { splitChunkAudio } from '../packages/automation/src/domain/services/ChunkAudioSplitter';
import { Lecture } from '../packages/automation/src/domain/entities/Lecture';

async function main() {
  const jsonFileName = process.argv[2];
  if (!jsonFileName) {
    console.error('사용법: npx tsx scripts/validate-boundary-cut.ts <lecture.json>');
    process.exit(1);
  }

  const lecturePath = path.join(config.paths.data, jsonFileName);
  const lecture = (await fs.readJson(lecturePath)) as Lecture;

  const debugDir = path.join(config.paths.root, 'tmp', 'chunked-audio', lecture.lecture_id);
  if (!(await fs.pathExists(debugDir))) {
    console.error(`디버그 산출물이 없습니다: ${debugDir}`);
    process.exit(1);
  }

  const videoConfig = config.getVideoConfig();
  const audioConfig = {
    sampleRate: videoConfig.audio.sampleRate,
    channels: videoConfig.audio.channels,
    bitDepth: videoConfig.audio.bitDepth,
    speechRate: 1,
  };

  const chunkFiles = (await fs.readdir(debugDir))
    .filter(name => /^chunk-\d+\.manifest\.json$/.test(name))
    .sort();

  console.log(`\n📋 경계 컷 검증: ${lecture.lecture_id}`);
  console.log(`   강의: ${jsonFileName}`);
  console.log(`   청크 수: ${chunkFiles.length}\n`);

  let totalBoundaries = 0;
  let oldTailLeakCount = 0;
  let oldHeadLeakCount = 0;
  let newTailLeakCount = 0;
  let newHeadLeakCount = 0;
  const details: Array<{
    chunk: number;
    from: number;
    to: number;
    oldCutMs: number;
    newCutMs: number;
    prevSpeechEndMs: number;
    nextSpeechStartMs: number;
    oldTailMs: number;
    oldHeadMs: number;
    newTailMs: number;
    newHeadMs: number;
    reasons: string[];
  }> = [];

  for (const manifestFile of chunkFiles) {
    const chunkIndex = parseInt(manifestFile.match(/chunk-(\d+)/)![1], 10);
    const manifest = await fs.readJson(path.join(debugDir, manifestFile));
    const alignment = await fs.readJson(path.join(debugDir, `chunk-${String(chunkIndex).padStart(3, '0')}.alignment.json`));
    const oldBoundaries = await fs.readJson(path.join(debugDir, `chunk-${String(chunkIndex).padStart(3, '0')}.boundaries.json`));
    const wav = await fs.readFile(path.join(debugDir, `chunk-${String(chunkIndex).padStart(3, '0')}.wav`));

    const result = splitChunkAudio(wav, alignment, manifest.segments, audioConfig);

    for (const newBoundary of result.boundaries) {
      const oldBoundary = oldBoundaries.find(
        (b: { fromSceneId: number; toSceneId: number }) =>
          b.fromSceneId === newBoundary.fromSceneId && b.toSceneId === newBoundary.toSceneId,
      );
      const oldCutMs = oldBoundary?.appliedCutMs ?? 0;
      // tail leak: cut 이 N 의 마지막 발화 끝보다 앞 (음수) → N 의 꼬리 발화를 자름
      const oldTailMs = oldCutMs - newBoundary.prevSpeechEndMs;
      const newTailMs = newBoundary.appliedCutMs - newBoundary.prevSpeechEndMs;
      // head leak: cut 이 N+1 의 첫 발화 시작보다 뒤 (양수) → N+1 의 머리 발화를 자름
      const oldHeadMs = oldCutMs - newBoundary.nextSpeechStartMs;
      const newHeadMs = newBoundary.appliedCutMs - newBoundary.nextSpeechStartMs;

      totalBoundaries++;
      if (oldTailMs < 0) oldTailLeakCount++;
      if (oldHeadMs > 0) oldHeadLeakCount++;
      if (newTailMs < 0) newTailLeakCount++;
      if (newHeadMs > 0) newHeadLeakCount++;

      details.push({
        chunk: chunkIndex,
        from: newBoundary.fromSceneId,
        to: newBoundary.toSceneId,
        oldCutMs,
        newCutMs: newBoundary.appliedCutMs,
        prevSpeechEndMs: newBoundary.prevSpeechEndMs,
        nextSpeechStartMs: newBoundary.nextSpeechStartMs,
        oldTailMs,
        oldHeadMs,
        newTailMs,
        newHeadMs,
        reasons: newBoundary.reasons,
      });
    }
  }

  console.log('씬 경계 비교 (tail<0 = N 꼬리 절단, head>0 = N+1 선두 절단):');
  console.log('─'.repeat(120));
  console.log(
    'chunk | from→to |  prev → next  | old_cut → new_cut | old_tail/head | new_tail/head | delta',
  );
  console.log('─'.repeat(120));
  for (const d of details) {
    const oldLeak = d.oldTailMs < 0 || d.oldHeadMs > 0 ? '❌' : '  ';
    const newLeak = d.newTailMs < 0 || d.newHeadMs > 0 ? '❌' : '✅';
    const delta = d.newCutMs - d.oldCutMs;
    console.log(
      `  ${d.chunk}   | ${String(d.from).padStart(3)}→${String(d.to).padEnd(3)}` +
      ` | ${String(d.prevSpeechEndMs).padStart(6)} → ${String(d.nextSpeechStartMs).padStart(6)}` +
      ` | ${String(d.oldCutMs).padStart(6)} → ${String(d.newCutMs).padStart(6)}` +
      ` | ${oldLeak} t=${String(d.oldTailMs).padStart(5)} h=${String(d.oldHeadMs).padStart(5)}` +
      ` | ${newLeak} t=${String(d.newTailMs).padStart(5)} h=${String(d.newHeadMs).padStart(5)}` +
      ` | ${delta >= 0 ? '+' : ''}${delta}ms` +
      (d.reasons.length > 0 ? ` [${d.reasons.join('; ')}]` : ''),
    );
  }
  console.log('─'.repeat(120));
  console.log(`\n총 ${totalBoundaries} 경계 중:`);
  console.log(`   기존 tail leak (N 꼬리 절단): ${oldTailLeakCount} (${((oldTailLeakCount / totalBoundaries) * 100).toFixed(1)}%)`);
  console.log(`   기존 head leak (N+1 선두 절단): ${oldHeadLeakCount} (${((oldHeadLeakCount / totalBoundaries) * 100).toFixed(1)}%)`);
  console.log(`   신규 tail leak (N 꼬리 절단): ${newTailLeakCount} (${((newTailLeakCount / totalBoundaries) * 100).toFixed(1)}%)`);
  console.log(`   신규 head leak (N+1 선두 절단): ${newHeadLeakCount} (${((newHeadLeakCount / totalBoundaries) * 100).toFixed(1)}%)`);

  const newTotalLeak = newTailLeakCount + newHeadLeakCount;
  if (newTotalLeak === 0) {
    console.log(`\n✅ 양방향 leak 없음`);
  } else {
    console.log(`\n❌ leak 잔존 (tail=${newTailLeakCount}, head=${newHeadLeakCount}) — 알고리즘 재검토 필요`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('\n❌ 검증 실패:', err);
  process.exit(1);
});
