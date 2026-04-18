import { GenerateAudioUseCase } from '../../application/use-cases/GenerateAudioUseCase';
import { Lecture } from '../../domain/entities/Lecture';
import { IAudioProviderFactory } from '../../domain/interfaces/IAudioProviderFactory';
import { ILectureRepository } from '../../domain/interfaces/ILectureRepository';
import {
  INarrationAudioPreparationService,
  NarrationAudioPreparationParams,
  NarrationAudioPreparationResult,
} from '../../domain/interfaces/INarrationAudioPreparationService';

export class ConfiguredNarrationAudioPreparationService implements INarrationAudioPreparationService {
  constructor(
    private readonly lectureRepository: ILectureRepository,
    private readonly audioProviderFactory: IAudioProviderFactory,
  ) {}

  async prepare(params: NarrationAudioPreparationParams): Promise<NarrationAudioPreparationResult> {
    const { provider, providerName } = this.audioProviderFactory.create();
    console.log(`🔊 오디오 프로바이더: ${providerName}`);
    console.log('\n--- 1단계: 나레이션 오디오 생성 ---');
    const targetSceneIds = params.targetSceneIds ?? [];
    const hasTargetScenes = targetSceneIds.length > 0;
    const targetLecture: Lecture = hasTargetScenes
      ? {
          ...params.lecture,
          sequence: params.lecture.sequence.filter(scene => targetSceneIds.includes(scene.scene_id)),
        }
      : params.lecture;

    if (hasTargetScenes) {
      console.log(`🎯 수정 모드: 지정 씬만 오디오 재생성 (${targetSceneIds.join(', ')})`);
    }

    const generateAudioUseCase = new GenerateAudioUseCase(provider, this.lectureRepository);
    await generateAudioUseCase.execute(targetLecture, { force: params.forceRegenerate });

    return { source: 'tts', providerName };
  }
}
