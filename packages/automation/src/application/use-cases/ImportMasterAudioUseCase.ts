import * as fs from 'fs-extra';
import * as path from 'path';
import { Lecture } from '../../domain/entities/Lecture';
import { ILectureRepository } from '../../domain/interfaces/ILectureRepository';
import { config } from '../../infrastructure/config';
import { FfmpegAudioSegmentProvider } from '../../infrastructure/providers/FfmpegAudioSegmentProvider';
import { computeRmsFrames, readWavMetadata } from '../../infrastructure/providers/WavAnalysisUtils';

type AlignmentWord = {
  text: string;
  start: number;
  end: number;
};

type AlignmentSegment = {
  text: string;
  start: number;
  end: number;
  words?: AlignmentWord[];
};

export type AlignmentManifest = {
  segments: AlignmentSegment[];
};

export interface ImportMasterAudioOptions {
  alignmentPath: string;
}

type AlignmentUnit = {
  text: string;
  startMs: number;
  endMs: number;
};

export type ImportedSceneTiming = {
  sceneId: number;
  narration: string;
  normalizedText: string;
  textStartMs: number;
  textEndMs: number;
  adjustedStartMs: number;
  adjustedEndMs: number;
  method: 'alignment' | 'alignment+energy-adjust';
};

type CharTimeline = {
  normalizedText: string;
  charStartsMs: number[];
  charEndsMs: number[];
};

const SEARCH_WINDOW_MS = 650;
const EDGE_PADDING_MS = 80;
const MIN_SCENE_DURATION_MS = 250;

function normalizeText(text: string): string {
  return text
    .normalize('NFKC')
    .replace(/\r\n/g, '\n')
    .replace(/\s+/g, '')
    .replace(/…/g, '...')
    .replace(/[\u200B-\u200D\uFEFF]/g, '');
}

function assertValidAlignmentManifest(value: unknown): asserts value is AlignmentManifest {
  if (!value || typeof value !== 'object' || !Array.isArray((value as AlignmentManifest).segments)) {
    throw new Error('alignment JSON 형식이 올바르지 않습니다. 최상위에 segments 배열이 필요합니다.');
  }
}

function flattenAlignmentUnits(manifest: AlignmentManifest): AlignmentUnit[] {
  const units: AlignmentUnit[] = [];

  for (const segment of manifest.segments) {
    const entries = Array.isArray(segment.words) && segment.words.length > 0 ? segment.words : [segment];
    for (const entry of entries) {
      if (typeof entry.text !== 'string' || typeof entry.start !== 'number' || typeof entry.end !== 'number') {
        continue;
      }
      const normalized = normalizeText(entry.text);
      if (!normalized) continue;
      units.push({
        text: normalized,
        startMs: Math.round(entry.start * 1000),
        endMs: Math.round(entry.end * 1000),
      });
    }
  }

  if (units.length === 0) {
    throw new Error('alignment JSON에서 사용할 수 있는 텍스트/타임스탬프 항목을 찾지 못했습니다.');
  }

  return units;
}

function buildCharTimeline(units: AlignmentUnit[]): CharTimeline {
  const normalizedParts: string[] = [];
  const charStartsMs: number[] = [];
  const charEndsMs: number[] = [];

  for (const unit of units) {
    const charCount = unit.text.length;
    const durationMs = Math.max(1, unit.endMs - unit.startMs);
    normalizedParts.push(unit.text);

    for (let index = 0; index < charCount; index++) {
      const startMs = Math.round(unit.startMs + (durationMs * index) / charCount);
      const endMs = Math.round(unit.startMs + (durationMs * (index + 1)) / charCount);
      charStartsMs.push(startMs);
      charEndsMs.push(Math.max(startMs + 1, endMs));
    }
  }

  return {
    normalizedText: normalizedParts.join(''),
    charStartsMs,
    charEndsMs,
  };
}

function buildInitialSceneTimings(lecture: Lecture, timeline: CharTimeline): ImportedSceneTiming[] {
  const timings: ImportedSceneTiming[] = [];
  let cursor = 0;

  for (const scene of lecture.sequence) {
    const normalizedNarration = normalizeText(scene.narration);
    if (!normalizedNarration) {
      throw new Error(`Scene ${scene.scene_id} narration이 비어 있어 분할할 수 없습니다.`);
    }

    const foundAt = timeline.normalizedText.indexOf(normalizedNarration, cursor);
    if (foundAt === -1) {
      throw new Error(
        `Scene ${scene.scene_id} 텍스트를 alignment 결과에서 찾지 못했습니다. ` +
        '원문과 TTS 발화가 달라졌거나 alignment JSON 형식이 예상과 다를 수 있습니다.'
      );
    }

    const endIndex = foundAt + normalizedNarration.length - 1;
    const textStartMs = timeline.charStartsMs[foundAt];
    const textEndMs = timeline.charEndsMs[endIndex];

    timings.push({
      sceneId: scene.scene_id,
      narration: scene.narration,
      normalizedText: normalizedNarration,
      textStartMs,
      textEndMs,
      adjustedStartMs: textStartMs,
      adjustedEndMs: textEndMs,
      method: 'alignment',
    });

    cursor = foundAt + normalizedNarration.length;
  }

  return timings;
}

function findLowestEnergyBoundary(
  targetMs: number,
  minMs: number,
  maxMs: number,
  frames: ReturnType<typeof computeRmsFrames>,
): number {
  if (maxMs <= minMs) {
    return Math.max(minMs, Math.min(maxMs, targetMs));
  }

  const candidates = frames.filter(frame => frame.startMs >= minMs && frame.endMs <= maxMs);
  if (candidates.length === 0) {
    return Math.round(Math.max(minMs, Math.min(maxMs, targetMs)));
  }

  let best = candidates[0];
  let bestDistance = Math.abs(((best.startMs + best.endMs) / 2) - targetMs);

  for (const frame of candidates.slice(1)) {
    const center = (frame.startMs + frame.endMs) / 2;
    const distance = Math.abs(center - targetMs);
    if (frame.rms < best.rms || (frame.rms === best.rms && distance < bestDistance)) {
      best = frame;
      bestDistance = distance;
    }
  }

  return Math.round((best.startMs + best.endMs) / 2);
}

function adjustSceneBoundaries(
  scenes: ImportedSceneTiming[],
  totalDurationMs: number,
  frames: ReturnType<typeof computeRmsFrames>,
): ImportedSceneTiming[] {
  if (scenes.length === 0) return scenes;

  const adjusted = scenes.map(scene => ({ ...scene }));
  adjusted[0].adjustedStartMs = Math.max(0, adjusted[0].textStartMs - EDGE_PADDING_MS);
  adjusted[adjusted.length - 1].adjustedEndMs = Math.min(totalDurationMs, adjusted[adjusted.length - 1].textEndMs + EDGE_PADDING_MS);

  for (let index = 0; index < adjusted.length - 1; index++) {
    const current = adjusted[index];
    const next = adjusted[index + 1];
    const targetMs = Math.round((current.textEndMs + next.textStartMs) / 2);
    const minMs = Math.max(
      current.adjustedStartMs + MIN_SCENE_DURATION_MS,
      targetMs - SEARCH_WINDOW_MS,
    );
    const maxMs = Math.min(
      totalDurationMs,
      next.textEndMs - MIN_SCENE_DURATION_MS,
      targetMs + SEARCH_WINDOW_MS,
    );

    const cutMs = findLowestEnergyBoundary(targetMs, minMs, maxMs, frames);
    current.adjustedEndMs = cutMs;
    next.adjustedStartMs = cutMs;
    current.method = 'alignment+energy-adjust';
    next.method = 'alignment+energy-adjust';
  }

  return adjusted;
}

function getDebugDir(lectureId: string): string {
  return path.join(config.paths.root, 'tmp', 'audio-segmentation', lectureId);
}

export class ImportMasterAudioUseCase {
  constructor(
    private readonly audioSegmentProvider: FfmpegAudioSegmentProvider,
    private readonly lectureRepository: ILectureRepository,
  ) {}

  async execute(
    lecture: Lecture,
    masterAudioPath: string,
    options: ImportMasterAudioOptions,
  ): Promise<ImportedSceneTiming[]> {
    if (!await fs.pathExists(masterAudioPath)) {
      throw new Error(`마스터 오디오 파일을 찾을 수 없습니다: ${masterAudioPath}`);
    }
    if (!await fs.pathExists(options.alignmentPath)) {
      throw new Error(`alignment JSON 파일을 찾을 수 없습니다: ${options.alignmentPath}`);
    }

    const rawAlignment = await fs.readJson(options.alignmentPath);
    assertValidAlignmentManifest(rawAlignment);

    const normalizedWavPath = await this.audioSegmentProvider.normalizeToMonoWav(masterAudioPath);

    try {
      const wavBuffer = await fs.readFile(normalizedWavPath);
      const wavMetadata = readWavMetadata(wavBuffer);
      const alignmentUnits = flattenAlignmentUnits(rawAlignment);
      const timeline = buildCharTimeline(alignmentUnits);
      const initialScenes = buildInitialSceneTimings(lecture, timeline);
      const rmsFrames = computeRmsFrames(wavBuffer, wavMetadata);
      const adjustedScenes = adjustSceneBoundaries(initialScenes, Math.round(wavMetadata.durationSec * 1000), rmsFrames);

      const debugDir = getDebugDir(lecture.lecture_id);
      await fs.ensureDir(debugDir);
      await fs.writeJson(path.join(debugDir, 'alignment.json'), rawAlignment, { spaces: 2 });
      await fs.writeJson(path.join(debugDir, 'segments.json'), adjustedScenes, { spaces: 2 });

      const durations: Record<string, number> = {};
      for (const scene of adjustedScenes) {
        const outputPath = this.lectureRepository.getAudioPath(lecture.lecture_id, scene.sceneId);
        await this.audioSegmentProvider.cutSegment(
          normalizedWavPath,
          outputPath,
          scene.adjustedStartMs / 1000,
          scene.adjustedEndMs / 1000,
        );

        const durationSec = await this.lectureRepository.getAudioDuration(lecture.lecture_id, scene.sceneId);
        if (!durationSec) {
          throw new Error(`Scene ${scene.sceneId} duration 계산에 실패했습니다.`);
        }
        durations[scene.sceneId] = durationSec;
      }

      await this.lectureRepository.saveAudioDurations(lecture.lecture_id, durations);
      return adjustedScenes;
    } finally {
      await fs.remove(normalizedWavPath);
    }
  }
}
