/**
 * 씬 내부 TTS 청크 일람 / 문구 검색 CLI.
 *
 * 씬의 나레이션을 파이프라인과 동일한 SyncPointNarrationChunker 로 쪼갠 뒤
 *   - 모든 청크의 인덱스·글자 범위·미리보기를 출력하거나
 *   - 특정 문구가 어느 청크에 속하는지 찾아 apply-tts-chunk 명령어를 제안한다.
 *
 * 사용 예:
 *   npx tsx list-chunks.ts lecture-02-01.json 16
 *   npx tsx list-chunks.ts lecture-02-01.json 16 --find "予期しない空白"
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import { Lecture, Scene } from '../../domain/entities/Lecture';
import { SyncPointNarrationChunker, NarrationChunk } from '../../domain/services/NarrationChunker';
import { config } from '../../infrastructure/config';

interface CliArgs {
  lectureFile: string;
  sceneId: number;
  findText?: string;
  previewChars: number;
}

function parseArgs(argv: string[]): CliArgs {
  const positional: string[] = [];
  let findText: string | undefined;
  let previewChars = 60;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--find' || arg === '-f') {
      findText = argv[++i];
      if (!findText) throw new Error('--find 뒤에 검색할 문구가 필요합니다');
    } else if (arg === '--preview') {
      const v = Number.parseInt(argv[++i] ?? '', 10);
      if (Number.isFinite(v) && v > 0) previewChars = v;
    } else if (arg.startsWith('--')) {
      throw new Error(`알 수 없는 옵션: ${arg}`);
    } else {
      positional.push(arg);
    }
  }

  if (positional.length < 2) {
    throw new Error(
      '사용법: list-chunks <lecture-file> <scene-id> [--find "문구"] [--preview 60]'
    );
  }

  const sceneId = Number.parseInt(positional[1], 10);
  if (!Number.isFinite(sceneId) || sceneId <= 0) {
    throw new Error(`scene-id 가 올바르지 않습니다: ${positional[1]}`);
  }

  return { lectureFile: positional[0], sceneId, findText, previewChars };
}

async function loadScene(lectureFile: string, sceneId: number): Promise<{ lecture: Lecture; scene: Scene }> {
  const lecturePath = path.isAbsolute(lectureFile)
    ? lectureFile
    : path.join(config.paths.data, lectureFile);
  if (!await fs.pathExists(lecturePath)) {
    throw new Error(`강의 파일을 찾을 수 없습니다: ${lecturePath}`);
  }
  const lecture = await fs.readJson(lecturePath) as Lecture;
  const scene = lecture.sequence.find(s => s.scene_id === sceneId);
  if (!scene) {
    throw new Error(`씬 ${sceneId} 를 찾을 수 없습니다: ${lectureFile}`);
  }
  return { lecture, scene };
}

interface ChunkBoundary {
  chunk: NarrationChunk;
  startChar: number;
  endChar: number;
}

function computeBoundaries(narration: string, chunks: NarrationChunk[]): ChunkBoundary[] {
  const result: ChunkBoundary[] = [];
  let cursor = 0;
  for (const chunk of chunks) {
    const startChar = cursor;
    const endChar = cursor + chunk.text.length;
    result.push({ chunk, startChar, endChar });
    cursor = endChar;
  }
  // 안전망
  if (cursor !== narration.length) {
    throw new Error(`청크 경계 합계가 원본 나레이션 길이와 다름: ${cursor} vs ${narration.length}`);
  }
  return result;
}

function truncate(text: string, maxChars: number): string {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (cleaned.length <= maxChars) return cleaned;
  return cleaned.slice(0, maxChars) + '…';
}

function printList(
  lectureFile: string,
  scene: Scene,
  boundaries: ChunkBoundary[],
  previewChars: number,
): void {
  const syncPoints = scene.visual.type === 'playwright' ? (scene.visual.syncPoints ?? []) : [];
  const totalChars = scene.narration.length;

  console.log(`\n📋 ${lectureFile} / scene ${scene.scene_id} — 총 ${boundaries.length}개 청크 (${totalChars}자, syncPoints ${syncPoints.length}개)\n`);

  const idxWidth = String(boundaries.length - 1).length;
  const charsWidth = String(totalChars).length;

  for (const { chunk, startChar, endChar } of boundaries) {
    const idx = String(chunk.index).padStart(idxWidth);
    const range = `${String(startChar).padStart(charsWidth)}-${String(endChar).padStart(charsWidth)}`;
    const size = String(endChar - startChar).padStart(4);
    const preview = truncate(chunk.text, previewChars);
    console.log(`  [chunk ${idx}] chars=${range} (${size}자)  ${preview}`);
  }

  console.log(`\n→ 재생성 명령 예시:`);
  console.log(`    make apply-tts-chunk LECTURE=${lectureFile} SCENE=${scene.scene_id} CHUNK=<N>`);
  console.log(`    make apply-tts-chunk LECTURE=${lectureFile} SCENE=${scene.scene_id} CHUNK='0 5 7'`);
}

function printFind(
  lectureFile: string,
  scene: Scene,
  boundaries: ChunkBoundary[],
  findText: string,
): void {
  // 모든 출현 위치 수집
  const positions: number[] = [];
  let from = 0;
  while (true) {
    const pos = scene.narration.indexOf(findText, from);
    if (pos < 0) break;
    positions.push(pos);
    from = pos + findText.length;
  }

  if (positions.length === 0) {
    console.log(`\n❌ '${findText}' 를 씬 ${scene.scene_id} 나레이션에서 찾을 수 없습니다.`);
    process.exit(1);
  }

  const matchedChunks = new Set<number>();
  for (const pos of positions) {
    const hit = boundaries.find(b => b.startChar <= pos && pos < b.endChar);
    if (hit) matchedChunks.add(hit.chunk.index);
  }

  const chunkList = Array.from(matchedChunks).sort((a, b) => a - b);
  console.log(
    `\n🔎 '${findText}' → ${positions.length}개 위치 출현 / chunk ${chunkList.join(', ')} 포함`
  );
  for (const pos of positions) {
    const hit = boundaries.find(b => b.startChar <= pos && pos < b.endChar);
    if (!hit) continue;
    const offsetInChunk = pos - hit.startChar;
    const snippetStart = Math.max(0, offsetInChunk - 15);
    const snippet = hit.chunk.text.slice(snippetStart, offsetInChunk + findText.length + 15);
    console.log(`    [chunk ${hit.chunk.index}] char ${pos} (chunk 내 offset ${offsetInChunk}) → …${snippet}…`);
  }

  console.log(`\n→ 재생성 명령:`);
  console.log(
    `    make apply-tts-chunk LECTURE=${lectureFile} SCENE=${scene.scene_id} CHUNK='${chunkList.join(' ')}'`
  );
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const { scene } = await loadScene(args.lectureFile, args.sceneId);
  const syncPoints = scene.visual.type === 'playwright' ? scene.visual.syncPoints : undefined;

  const chunker = new SyncPointNarrationChunker();
  const chunks = chunker.chunk(scene.narration, syncPoints);
  const boundaries = computeBoundaries(scene.narration, chunks);

  if (args.findText) {
    printFind(args.lectureFile, scene, boundaries, args.findText);
  } else {
    printList(args.lectureFile, scene, boundaries, args.previewChars);
  }
}

main().catch(err => {
  console.error(`\n❌ ${err.message}`);
  process.exit(1);
});
