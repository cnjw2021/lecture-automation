import * as crypto from 'crypto';
import { Lecture } from '../entities/Lecture';
import { MasterAudioGeneratorDescriptor, MasterAudioManifest } from '../entities/MasterAudioManifest';

export function buildMasterAudioScript(lecture: Lecture): string {
  return lecture.sequence.map(scene => scene.narration.trim()).join('\n\n').trim();
}

export function computeMasterAudioHash(input: string): string {
  return crypto.createHash('sha256').update(input, 'utf8').digest('hex');
}

export function buildMasterAudioManifest(params: {
  lecture: Lecture;
  jsonFileName: string;
  script: string;
  generator: MasterAudioGeneratorDescriptor;
}): MasterAudioManifest {
  return {
    version: 1,
    lectureId: params.lecture.lecture_id,
    sourceJson: params.jsonFileName,
    sceneCount: params.lecture.sequence.length,
    scriptHash: computeMasterAudioHash(params.script),
    scriptLength: params.script.length,
    generator: params.generator,
    generatedAt: new Date().toISOString(),
  };
}

export function isSameMasterAudioGenerator(
  left: MasterAudioGeneratorDescriptor,
  right: MasterAudioGeneratorDescriptor,
): boolean {
  return left.provider === right.provider
    && left.modelName === right.modelName
    && left.voiceName === right.voiceName
    && left.styleVersion === right.styleVersion
    && left.promptHash === right.promptHash
    && left.temperature === right.temperature
    && left.seed === right.seed;
}
