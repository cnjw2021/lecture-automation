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
 * 청크 분할 규칙은 이슈 #113 의 "청크 경계 제안" 을 따른다:
 *   - syncPoints.phrase 의 나레이션 내 출현 위치를 경계로 잡아 `phrase` 를 다음 청크의 시작부로 붙인다.
 *   - syncPoints 가 비어있으면 청크 1개(=씬 단위 TTS 와 동치) 를 반환한다.
 *
 * 구현이 domain 에 있는 이유: 외부 의존성 없이 씬의 나레이션 + syncPoints 만으로 결정되는
 *  순수한 비즈니스 규칙이기 때문.
 */
export interface INarrationChunker {
  chunk(narration: string, syncPoints?: PlaywrightSyncPoint[]): NarrationChunk[];
}

/**
 * 청크 경계가 일본어 문장 시작(바로 앞 문자가 '。' 또는 줄바꿈이거나 position=0) 에
 * 정렬되는지 확인한다. forward sync(SyncPlaywrightUseCase) 의 무음 기반 문장 경계 감지가
 * 청크 경계와 정합하려면 phrase 가 문장 시작점에 찍혀 있어야 한다.
 *
 * export: 진단·테스트 용도. 프로덕션 경로에서는 warn 만 남기고 분할은 그대로 진행.
 */
export function isSentenceBoundary(narration: string, pos: number): boolean {
  if (pos <= 0) return true;
  const prev = narration[pos - 1];
  return prev === '。' || prev === '\n' || prev === '！' || prev === '？';
}

export class SyncPointNarrationChunker implements INarrationChunker {
  chunk(narration: string, syncPoints?: PlaywrightSyncPoint[]): NarrationChunk[] {
    const trimmed = narration;
    if (!syncPoints || syncPoints.length === 0) {
      return [{ index: 0, text: trimmed }];
    }

    // phrase 의 나레이션 내 출현 위치(0-base) 를 수집. 중복·미발견 phrase 는 건너뜀.
    const boundaries: { pos: number; phrase: string }[] = [];
    const seen = new Set<number>();
    for (const sp of syncPoints) {
      const pos = narration.indexOf(sp.phrase);
      if (pos <= 0) continue; // 0 이거나 미발견이면 경계로 쓸 수 없음
      if (seen.has(pos)) continue;
      seen.add(pos);
      if (!isSentenceBoundary(narration, pos)) {
        // 문장 중간 분할은 prosody 끊김 + 무음 기반 싱크 교란 가능.
        // 분할은 진행하되 경고해 작성자가 phrase 위치를 재검토할 수 있게 한다.
        console.warn(
          `  ⚠️ NarrationChunker: phrase "${sp.phrase.slice(0, 20)}..." 위치(${pos}) 가 ` +
          `문장 시작점이 아님 (앞 문자='${narration[pos - 1]}'). 싱크 오차 가능성.`
        );
      }
      boundaries.push({ pos, phrase: sp.phrase });
    }

    if (boundaries.length === 0) {
      return [{ index: 0, text: trimmed }];
    }

    boundaries.sort((a, b) => a.pos - b.pos);

    const chunks: NarrationChunk[] = [];
    let cursor = 0;
    for (let i = 0; i < boundaries.length; i++) {
      const { pos, phrase } = boundaries[i];
      if (pos <= cursor) continue; // 동일 위치 중복 방어
      const text = narration.slice(cursor, pos);
      if (text.length > 0) {
        chunks.push({
          index: chunks.length,
          text,
          phrase: chunks.length === 0 ? undefined : boundaries[i - 1]?.phrase,
        });
      }
      cursor = pos;
      // 마지막 phrase 의 phrase 필드는 현재 경계의 phrase 로 세팅해 다음 청크에 연결
    }
    const tail = narration.slice(cursor);
    if (tail.length > 0) {
      chunks.push({
        index: chunks.length,
        text: tail,
        phrase: boundaries[boundaries.length - 1]?.phrase,
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
