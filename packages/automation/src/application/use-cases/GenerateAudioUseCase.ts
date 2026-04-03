import { Lecture } from '../../domain/entities/Lecture';
import { IAudioProvider } from '../../domain/interfaces/IAudioProvider';
import { ILectureRepository } from '../../domain/interfaces/ILectureRepository';

export interface GenerateAudioUseCaseOptions {
  force?: boolean;
}

export class GenerateAudioUseCase {
  constructor(
    private readonly audioProvider: IAudioProvider,
    private readonly lectureRepository: ILectureRepository
  ) {}

  async execute(lecture: Lecture, options: GenerateAudioUseCaseOptions = {}): Promise<any[]> {
    const { force = false } = options;
    console.log(`[${lecture.lecture_id}] 오디오 공정 시작 (Provider: ${this.audioProvider.constructor.name})`);

    const results: any[] = [];
    const durations: Record<string, number> = {};

    for (const scene of lecture.sequence) {
      if (!force && await this.lectureRepository.existsAudio(lecture.lecture_id, scene.scene_id)) {
        console.log(`- Scene ${scene.scene_id} 이미 존재함 (스킵)`);
        const existingDuration = await this.lectureRepository.getAudioDuration(lecture.lecture_id, scene.scene_id);
        if (existingDuration) {
          durations[scene.scene_id] = existingDuration;
        }
        continue;
      }

      try {
        const { buffer, durationSec } = await this.audioProvider.generate(scene.narration, {
          scene_id: scene.scene_id
        });

        await this.lectureRepository.saveAudio(lecture.lecture_id, scene.scene_id, buffer);

        durations[scene.scene_id] = durationSec;
        results.push({ scene_id: scene.scene_id, status: 'success', durationSec });
      } catch (error) {
        console.error(`\n❌ [치명적 에러] Scene ${scene.scene_id} 생성 중 오류 발생.`);
        console.error('--- 상세 에러 정보 ---');
        console.dir(error, { depth: null });
        console.error('----------------------');
        throw error;
      }
    }

    await this.lectureRepository.saveAudioDurations(lecture.lecture_id, durations);
    console.log(`[${lecture.lecture_id}] 오디오 duration 메타데이터 저장 완료`);

    return results;
  }
}
