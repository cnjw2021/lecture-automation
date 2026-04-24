import { PlaywrightSyncPoint } from '../entities/Lecture';

/**
 * 씬 내부 나레이션을 TTS 호출 단위로 쪼갠 결과.
 *
 * - `index`  : 0-base 청크 순번. 파일명 `scene-{sceneId}-chunk-{index}.wav` 에 사용.
 * - `text`   : 해당 청크에 포함되는 나레이션 부분 문자열.
 * - `phrase` : 청크 경계를 발생시킨 syncPoint.phrase. 첫 청크(index=0)는 undefined.
 *              디버그용 참고값이며 TTS 호출에는 사용되지 않는다.
 */
export interface NarrationChunk {
  index: number;
  text: string;
  phrase?: string;
}

/**
 * 나레이션을 청크 단위로 분할하는 전략(domain service).
 *
 * 청크 경계는 syncPoints 의 "부분집합" 이다. syncPoints 는 씬 전체 wav 의
 * character alignment 로 싱크에 사용되므로 청크 경계와 독립적이며, 청크는
 * TTS 호출 단위로서 자연스러운 프로소디 길이를 유지하는 것이 목적이다.
 *
 * 경계 선택 규칙:
 *   1) syncPoints.phrase 의 나레이션 내 출현 위치를 후보로 수집 (pos>0 만)
 *   2) 문장 경계(`。/！/？/\n` 직후 또는 줄바꿈) 에 있는 후보만 남김.
 *      문장 경계 후보가 하나도 없으면 safety 로 전체 후보를 그대로 사용.
 *   3) 글자수 greedy 병합: 인접 경계 사이 또는 경계-끝 거리가 `minChunkChars`
 *      미만이면 해당 경계를 버려 인접 청크와 병합.
 *
 * 구현이 domain 에 있는 이유: 외부 의존성 없이 씬의 나레이션 + syncPoints 만으로
 * 결정되는 순수한 비즈니스 규칙이기 때문.
 */
export interface INarrationChunker {
  chunk(narration: string, syncPoints?: PlaywrightSyncPoint[]): NarrationChunk[];
}

/**
 * 청크 경계가 일본어 문장 시작(바로 앞 문자가 '。' 또는 줄바꿈이거나 position=0) 에
 * 정렬되는지 확인한다.
 *
 * export: 진단·테스트 용도.
 */
export function isSentenceBoundary(narration: string, pos: number): boolean {
  if (pos <= 0) return true;
  const prev = narration[pos - 1];
  return prev === '。' || prev === '\n' || prev === '！' || prev === '？';
}

export interface SyncPointNarrationChunkerOptions {
  /**
   * 청크 최소 글자수. 인접 경계 사이 거리 또는 마지막 경계-끝 거리가
   * 이 값 미만이면 해당 경계를 버려 인접 청크와 병합한다. 기본 150.
   * 0 이면 모든 syncPoint 경계를 그대로 사용 (원시 분할).
   */
  minChunkChars?: number;
}

export class SyncPointNarrationChunker implements INarrationChunker {
  private readonly minChunkChars: number;

  constructor(options: SyncPointNarrationChunkerOptions = {}) {
    this.minChunkChars = options.minChunkChars ?? 150;
  }

  chunk(narration: string, syncPoints?: PlaywrightSyncPoint[]): NarrationChunk[] {
    if (!syncPoints || syncPoints.length === 0) {
      return [{ index: 0, text: narration }];
    }

    // 1) phrase 출현 위치 수집 (pos>0, 중복 제거)
    interface RawBoundary {
      pos: number;
      phrase: string;
      isSentenceStart: boolean;
    }
    const rawBoundaries: RawBoundary[] = [];
    const seen = new Set<number>();
    for (const sp of syncPoints) {
      const pos = narration.indexOf(sp.phrase);
      if (pos <= 0) continue;
      if (seen.has(pos)) continue;
      seen.add(pos);
      const sentenceStart = isSentenceBoundary(narration, pos);
      if (!sentenceStart) {
        console.warn(
          `  ⚠️ NarrationChunker: phrase "${sp.phrase.slice(0, 20)}..." 위치(${pos}) 가 ` +
          `문장 시작점이 아님 (앞 문자='${narration[pos - 1]}'). 싱크 오차 가능성.`
        );
      }
      rawBoundaries.push({ pos, phrase: sp.phrase, isSentenceStart: sentenceStart });
    }

    if (rawBoundaries.length === 0) {
      return [{ index: 0, text: narration }];
    }

    rawBoundaries.sort((a, b) => a.pos - b.pos);

    // 2) 문장 경계 우선 필터. 문장 경계가 하나라도 있으면 그것만 사용.
    const sentenceBoundaries = rawBoundaries.filter(b => b.isSentenceStart);
    const poolBoundaries = sentenceBoundaries.length > 0 ? sentenceBoundaries : rawBoundaries;

    // 3) 글자수 greedy 병합
    const filteredBoundaries: { pos: number; phrase: string }[] = [];
    let cursor = 0;
    for (const b of poolBoundaries) {
      const prevLen = b.pos - cursor;
      const remainingLen = narration.length - b.pos;
      if (prevLen < this.minChunkChars) continue;
      if (remainingLen < this.minChunkChars) continue;
      filteredBoundaries.push({ pos: b.pos, phrase: b.phrase });
      cursor = b.pos;
    }

    if (filteredBoundaries.length === 0) {
      return [{ index: 0, text: narration }];
    }

    // 4) 청크 생성
    const chunks: NarrationChunk[] = [];
    let chunkCursor = 0;
    for (let i = 0; i < filteredBoundaries.length; i++) {
      const { pos } = filteredBoundaries[i];
      if (pos <= chunkCursor) continue;
      const text = narration.slice(chunkCursor, pos);
      if (text.length > 0) {
        chunks.push({
          index: chunks.length,
          text,
          phrase: chunks.length === 0 ? undefined : filteredBoundaries[i - 1]?.phrase,
        });
      }
      chunkCursor = pos;
    }
    const tail = narration.slice(chunkCursor);
    if (tail.length > 0) {
      chunks.push({
        index: chunks.length,
        text: tail,
        phrase: filteredBoundaries[filteredBoundaries.length - 1]?.phrase,
      });
    }

    // 안전망: 모든 청크를 합치면 원본 나레이션이 되어야 함.
    const reassembled = chunks.map(c => c.text).join('');
    if (reassembled !== narration) {
      throw new Error(
        `NarrationChunker: 청크 재조립 결과가 원본과 불일치 (chunks=${chunks.length}). ` +
        `원본 길이=${narration.length}, 재조립 길이=${reassembled.length}`
      );
    }

    return chunks;
  }
}
