/**
 * 새 경계 컷 알고리즘 검증 스크립트
 *
 * 기존 청크 디버그 산출물을 읽어, 새 알고리즘으로 cut 을 재계산하고
 * 이전 결과와 비교하여 leak(음수 tail) 이 해소되는지 확인한다.
 * **WAV를 새로 쓰지 않음** — 진단만 출력.
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
  let oldLeakCount = 0;
  let newLeakCount = 0;
  const details: Array<{
    chunk: number;
    from: number;
    to: number;
    oldCutMs: number;
    newCutMs: number;
    prevSpeechEndMs: number;
    nextSpeechStartMs: number;
    oldTailMs: number;
    newTailMs: number;
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
      const oldTailMs = oldCutMs - newBoundary.prevSpeechEndMs;
      const newTailMs = newBoundary.appliedCutMs - newBoundary.prevSpeechEndMs;

      totalBoundaries++;
      if (oldTailMs < 0) oldLeakCount++;
      if (newTailMs < 0) newLeakCount++;

      details.push({
        chunk: chunkIndex,
        from: newBoundary.fromSceneId,
        to: newBoundary.toSceneId,
        oldCutMs,
        newCutMs: newBoundary.appliedCutMs,
        prevSpeechEndMs: newBoundary.prevSpeechEndMs,
        nextSpeechStartMs: newBoundary.nextSpeechStartMs,
        oldTailMs,
        newTailMs,
        reasons: newBoundary.reasons,
      });
    }
  }

  console.log('씬 경계 비교 (tail < 0 = leak):');
  console.log('─'.repeat(100));
  console.log(
    'chunk | from→to | prev_speech_end → next_speech_start | old_cut → new_cut | old_tail → new_tail | delta',
  );
  console.log('─'.repeat(100));
  for (const d of details) {
    const oldMark = d.oldTailMs < 0 ? '❌' : '  ';
    const newMark = d.newTailMs < 0 ? '❌' : '✅';
    const delta = d.newCutMs - d.oldCutMs;
    console.log(
      `  ${d.chunk}   | ${String(d.from).padStart(3)}→${String(d.to).padEnd(3)}` +
      ` | ${String(d.prevSpeechEndMs).padStart(6)}ms → ${String(d.nextSpeechStartMs).padStart(6)}ms` +
      ` | ${String(d.oldCutMs).padStart(6)} → ${String(d.newCutMs).padStart(6)}ms` +
      ` | ${oldMark}${String(d.oldTailMs).padStart(5)}ms → ${newMark}${String(d.newTailMs).padStart(5)}ms` +
      ` | ${delta >= 0 ? '+' : ''}${delta}ms` +
      (d.reasons.length > 0 ? ` [${d.reasons.join('; ')}]` : ''),
    );
  }
  console.log('─'.repeat(100));
  console.log(`\n총 ${totalBoundaries} 경계 중:`);
  console.log(`   기존 leak: ${oldLeakCount} (${((oldLeakCount / totalBoundaries) * 100).toFixed(1)}%)`);
  console.log(`   신규 leak: ${newLeakCount} (${((newLeakCount / totalBoundaries) * 100).toFixed(1)}%)`);

  if (newLeakCount < oldLeakCount) {
    console.log(`\n✅ 개선: ${oldLeakCount - newLeakCount}건의 leak 해소`);
  } else if (newLeakCount === 0) {
    console.log(`\n✅ 완전 해소: leak 없음`);
  } else {
    console.log(`\n⚠️  leak 유지 또는 증가 — 알고리즘 재검토 필요`);
  }
}

main().catch((err) => {
  console.error('\n❌ 검증 실패:', err);
  process.exit(1);
});
