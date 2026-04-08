import { Lecture } from '../../domain/entities/Lecture';
import { IAudioProvider } from '../../domain/interfaces/IAudioProvider';
import { ILectureRepository } from '../../domain/interfaces/ILectureRepository';

export interface GenerateAudioUseCaseOptions {
  force?: boolean;
}

export class GenerateAudioUseCase {
  private readonly REQUEST_INTERVAL_MS = 7000; // RPM 10 제한 대응 (약 8.5 req/min)

  constructor(
    private readonly audioProvider: IAudioProvider,
    private readonly lectureRepository: ILectureRepository
  ) {}

  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async execute(lecture: Lecture, options: GenerateAudioUseCaseOptions = {}): Promise<any[]> {
    const { force = false } = options;
    console.log(`[${lecture.lecture_id}] 오디오 공정 시작 (Provider: ${this.audioProvider.constructor.name})`);

    const results: any[] = [];
    const durations: Record<string, number> = {};
    let lastRequestTime = 0;

    for (const scene of lecture.sequence) {
      if (!force && await this.lectureRepository.existsAudio(lecture.lecture_id, scene.scene_id)) {
        console.log(`- Scene ${scene.scene_id} 이미 존재함 (스킵)`);
        const existingDuration = await this.lectureRepository.getAudioDuration(lecture.lecture_id, scene.scene_id);
        if (existingDuration) {
          durations[scene.scene_id] = existingDuration;
        }
        continue;
      }

      // RPM 제한 대응: 요청 간 최소 간격 유지
      const elapsed = Date.now() - lastRequestTime;
      if (lastRequestTime > 0 && elapsed < this.REQUEST_INTERVAL_MS) {
        const waitMs = this.REQUEST_INTERVAL_MS - elapsed;
        console.log(`  ⏳ RPM 제한 대응 대기 (${(waitMs / 1000).toFixed(1)}초)...`);
        await this.sleep(waitMs);
      }

      try {
        lastRequestTime = Date.now();
        const { buffer, durationSec } = await this.audioProvider.generate(scene.narration, {
          scene_id: scene.scene_id,
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
