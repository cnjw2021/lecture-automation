import { Scene } from '../entities/Lecture';

/** 청크 내 개별 씬의 나레이션 위치 정보 */
export interface SceneNarrationSegment {
  sceneId: number;
  narration: string;
  /** 청크 결합 텍스트에서 이 씬 나레이션의 시작 문자 인덱스 */
  startCharIndex: number;
  /** 이 씬 나레이션의 문자 수 (구분자 제외) */
  charCount: number;
}

/** 복수 씬의 나레이션을 결합한 청크 */
export interface NarrationChunk {
  segments: SceneNarrationSegment[];
  /** 구분자로 연결된 전체 텍스트 (TTS API에 전송) */
  text: string;
}

const CHUNK_SEPARATOR = '\n';

/**
 * 씬 배열을 maxCharsPerChunk 이내의 청크로 그룹핑한다.
 * 씬이 청크 경계에 걸려 분리되는 일은 없다.
 * 단일 씬이 maxCharsPerChunk를 초과하면 해당 씬만으로 독립 청크를 구성한다.
 */
export function groupScenesIntoChunks(
  scenes: ReadonlyArray<Pick<Scene, 'scene_id' | 'narration'>>,
  maxCharsPerChunk: number,
): NarrationChunk[] {
  const chunks: NarrationChunk[] = [];
  let pendingSegments: SceneNarrationSegment[] = [];
  let pendingCharCount = 0;

  for (const scene of scenes) {
    const narrationLength = scene.narration.length;
    const separatorLength = pendingSegments.length > 0 ? CHUNK_SEPARATOR.length : 0;
    const totalIfAdded = pendingCharCount + separatorLength + narrationLength;

    if (pendingSegments.length > 0 && totalIfAdded > maxCharsPerChunk) {
      chunks.push(buildChunk(pendingSegments));
      pendingSegments = [];
      pendingCharCount = 0;
    }

    const startCharIndex = pendingCharCount + (pendingSegments.length > 0 ? CHUNK_SEPARATOR.length : 0);
    pendingSegments.push({
      sceneId: scene.scene_id,
      narration: scene.narration,
      startCharIndex,
      charCount: narrationLength,
    });
    pendingCharCount = startCharIndex + narrationLength;
  }

  if (pendingSegments.length > 0) {
    chunks.push(buildChunk(pendingSegments));
  }

  return chunks;
}

function buildChunk(segments: SceneNarrationSegment[]): NarrationChunk {
  const text = segments.map(s => s.narration).join(CHUNK_SEPARATOR);
  return { segments, text };
}
