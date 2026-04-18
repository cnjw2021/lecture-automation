import * as fs from 'fs-extra';
import * as path from 'path';
import { Lecture } from '../../domain/entities/Lecture';
import { config } from '../../infrastructure/config';

const SCENE_GAP_MS = 1500;

export class MergeAudioUseCase {
  private readonly audioBaseDir = config.paths.audio;
  private readonly outputDir = config.paths.output;

  async execute(lecture: Lecture, targetSceneIds?: number[]): Promise<string> {
    const lectureAudioDir = path.join(this.audioBaseDir, lecture.lecture_id);
    const allSceneIds = lecture.sequence.map(s => s.scene_id);
    const sceneIds = targetSceneIds && targetSceneIds.length > 0
      ? allSceneIds.filter(id => targetSceneIds.includes(id))
      : allSceneIds;

    // 씬 순서대로 WAV 파일 읽기
    const wavBuffers: Buffer[] = [];
    for (const sceneId of sceneIds) {
      const filePath = path.join(lectureAudioDir, `scene-${sceneId}.wav`);
      if (!await fs.pathExists(filePath)) {
        throw new Error(`오디오 파일 없음: scene-${sceneId}.wav`);
      }
      wavBuffers.push(await fs.readFile(filePath));
    }

    // 첫 번째 파일에서 WAV 헤더 파라미터 추출 (44바이트 고정 헤더)
    const firstHeader = wavBuffers[0];
    const sampleRate = firstHeader.readUInt32LE(24);
    const channels = firstHeader.readUInt16LE(22);
    const bitDepth = firstHeader.readUInt16LE(34);
    const bytesPerFrame = channels * (bitDepth / 8);

    // 씬 간 무음 버퍼 (1.5초)
    const gapSamples = Math.floor((SCENE_GAP_MS / 1000) * sampleRate) * channels;
    const gapBuffer = Buffer.alloc(gapSamples * (bitDepth / 8), 0);

    // 각 파일의 PCM 데이터(헤더 44바이트 제외) + 씬 간 무음 삽입
    const pcmParts: Buffer[] = [];
    for (let i = 0; i < wavBuffers.length; i++) {
      pcmParts.push(wavBuffers[i].subarray(44));
      if (i < wavBuffers.length - 1) {
        pcmParts.push(gapBuffer);
      }
    }
    const totalPcm = Buffer.concat(pcmParts);
    const dataSize = totalPcm.length;

    // 새 WAV 헤더 작성
    const header = Buffer.alloc(44);
    header.write('RIFF', 0);
    header.writeUInt32LE(36 + dataSize, 4);
    header.write('WAVE', 8);
    header.write('fmt ', 12);
    header.writeUInt32LE(16, 16);
    header.writeUInt16LE(1, 20);        // PCM
    header.writeUInt16LE(channels, 22);
    header.writeUInt32LE(sampleRate, 24);
    header.writeUInt32LE(sampleRate * bytesPerFrame, 28);
    header.writeUInt16LE(bytesPerFrame, 32);
    header.writeUInt16LE(bitDepth, 34);
    header.write('data', 36);
    header.writeUInt32LE(dataSize, 40);

    const merged = Buffer.concat([header, totalPcm]);
    const totalSec = dataSize / (sampleRate * bytesPerFrame);

    await fs.ensureDir(this.outputDir);
    const suffix = targetSceneIds && targetSceneIds.length > 0
      ? `-scenes-${sceneIds.join('-')}`
      : '';
    const outputPath = path.join(this.outputDir, `${lecture.lecture_id}-audio-preview${suffix}.wav`);
    await fs.writeFile(outputPath, merged);

    const minutes = Math.floor(totalSec / 60);
    const seconds = Math.round(totalSec % 60);
    console.log(`✅ 오디오 머지 완료: ${outputPath}`);
    console.log(`   씬 수: ${sceneIds.length}개 | 씬 간 갭: ${SCENE_GAP_MS}ms | 총 재생 시간: ${minutes}분 ${seconds}초`);

    return outputPath;
  }
}
