import * as path from 'path';
import { Lecture } from '../../domain/entities/Lecture';
import { IClipRepository } from '../../domain/interfaces/IClipRepository';
import { IConcatProvider } from '../../domain/interfaces/IConcatProvider';
import { config } from '../../infrastructure/config';

export class ConcatClipsUseCase {
  constructor(
    private readonly concatProvider: IConcatProvider,
    private readonly clipRepository: IClipRepository
  ) {}

  async execute(lecture: Lecture): Promise<string> {
    const startTime = Date.now();
    console.log(`\n🔗 씬 클립 이어붙이기 시작 (총 ${lecture.sequence.length}개 씬)`);

    const sceneIds = lecture.sequence.map(s => s.scene_id);
    const clipPaths = this.clipRepository.getClipPaths(lecture.lecture_id, sceneIds);
    const outputPath = path.join(config.paths.output, `${lecture.lecture_id}.mp4`);

    await this.concatProvider.concat(clipPaths, outputPath);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`✅ 이어붙이기 완료 (${elapsed}초)`);
    console.log(`📍 결과물: ${outputPath}`);
    return outputPath;
  }
}
