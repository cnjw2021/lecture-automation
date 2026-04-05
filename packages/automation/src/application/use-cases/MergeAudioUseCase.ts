import * as fs from 'fs-extra';
import * as path from 'path';
import { Lecture } from '../../domain/entities/Lecture';
import { config } from '../../infrastructure/config';

export class MergeAudioUseCase {
  private readonly audioBaseDir = config.paths.audio;
  private readonly outputDir = config.paths.output;

  async execute(lecture: Lecture): Promise<string> {
    const lectureAudioDir = path.join(this.audioBaseDir, lecture.lecture_id);
    const sceneIds = lecture.sequence.map(s => s.scene_id);

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

    // 각 파일의 PCM 데이터(헤더 44바이트 제외) 추출 후 합산
    const pcmChunks = wavBuffers.map(buf => buf.subarray(44));
    const totalPcm = Buffer.concat(pcmChunks);
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
    header.writeUInt32LE(sampleRate * channels * (bitDepth / 8), 28);
    header.writeUInt16LE(channels * (bitDepth / 8), 32);
    header.writeUInt16LE(bitDepth, 34);
    header.write('data', 36);
    header.writeUInt32LE(dataSize, 40);

    const merged = Buffer.concat([header, totalPcm]);
    const totalSec = dataSize / (sampleRate * channels * (bitDepth / 8));

    await fs.ensureDir(this.outputDir);
    const outputPath = path.join(this.outputDir, `${lecture.lecture_id}-audio-preview.wav`);
    await fs.writeFile(outputPath, merged);

    const minutes = Math.floor(totalSec / 60);
    const seconds = Math.round(totalSec % 60);
    console.log(`✅ 오디오 머지 완료: ${outputPath}`);
    console.log(`   씬 수: ${sceneIds.length}개 | 총 재생 시간: ${minutes}분 ${seconds}초`);

    return outputPath;
  }
}
