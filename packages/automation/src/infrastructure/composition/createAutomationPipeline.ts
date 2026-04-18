import { RunAutomationPipelineUseCase } from '../../application/use-cases/RunAutomationPipelineUseCase';
import { CaptureScreenshotUseCase } from '../../application/use-cases/CaptureScreenshotUseCase';
import { CaptureSharedLiveDemoSessionsUseCase } from '../../application/use-cases/CaptureSharedLiveDemoSessionsUseCase';
import { ConcatClipsUseCase } from '../../application/use-cases/ConcatClipsUseCase';
import { MergeAudioUseCase } from '../../application/use-cases/MergeAudioUseCase';
import { RecordVisualUseCase } from '../../application/use-cases/RecordVisualUseCase';
import { RenderSceneClipsUseCase } from '../../application/use-cases/RenderSceneClipsUseCase';
import { ReverseSyncPlaywrightUseCase } from '../../application/use-cases/ReverseSyncPlaywrightUseCase';
import { SyncPlaywrightUseCase } from '../../application/use-cases/SyncPlaywrightUseCase';
import { ValidateLectureUseCase } from '../../application/use-cases/ValidateLectureUseCase';
import { ConfiguredAudioProviderFactory } from '../factories/ConfiguredAudioProviderFactory';
import { ElevenLabsConfiguredAudioProviderBuilder } from '../factories/ElevenLabsConfiguredAudioProviderBuilder';
import { GeminiCloudTtsConfiguredAudioProviderBuilder } from '../factories/GeminiCloudTtsConfiguredAudioProviderBuilder';
import { GeminiConfiguredAudioProviderBuilder } from '../factories/GeminiConfiguredAudioProviderBuilder';
import { GoogleCloudTtsConfiguredAudioProviderBuilder } from '../factories/GoogleCloudTtsConfiguredAudioProviderBuilder';
import { FfmpegConcatProvider } from '../providers/FfmpegConcatProvider';
import { PlaywrightScreenshotProvider } from '../providers/PlaywrightScreenshotProvider';
import { PlaywrightStateCaptureProvider } from '../providers/PlaywrightStateCaptureProvider';
import { PlaywrightVisualProvider } from '../providers/PlaywrightVisualProvider';
import { SharedPlaywrightStateCaptureProvider } from '../providers/SharedPlaywrightStateCaptureProvider';
import { RemotionSceneClipRenderProvider } from '../providers/RemotionSceneClipRenderProvider';
import { FileClipRepository } from '../repositories/FileClipRepository';
import { FileLectureRepository } from '../repositories/FileLectureRepository';
import { ConfiguredNarrationAudioPreparationService } from '../services/ConfiguredNarrationAudioPreparationService';

export function createAutomationPipeline(): RunAutomationPipelineUseCase {
  const lectureRepository = new FileLectureRepository();
  const clipRepository = new FileClipRepository();
  const audioProviderFactory = new ConfiguredAudioProviderFactory([
    new GeminiConfiguredAudioProviderBuilder(),
    new GoogleCloudTtsConfiguredAudioProviderBuilder(),
    new GeminiCloudTtsConfiguredAudioProviderBuilder(),
    new ElevenLabsConfiguredAudioProviderBuilder(),
  ]);
  const narrationAudioPreparationService = new ConfiguredNarrationAudioPreparationService(
    lectureRepository,
    audioProviderFactory,
  );

  const validateLectureUseCase = new ValidateLectureUseCase();
  const mergeAudioUseCase = new MergeAudioUseCase();
  const syncPlaywrightUseCase = new SyncPlaywrightUseCase(lectureRepository);
  const reverseSyncPlaywrightUseCase = new ReverseSyncPlaywrightUseCase(lectureRepository);
  const captureScreenshotUseCase = new CaptureScreenshotUseCase(new PlaywrightScreenshotProvider(), lectureRepository);
  const recordVisualUseCase = new RecordVisualUseCase(
    new PlaywrightVisualProvider(),
    lectureRepository,
    new PlaywrightStateCaptureProvider(),
  );
  const captureSharedLiveDemoSessionsUseCase = new CaptureSharedLiveDemoSessionsUseCase(
    new SharedPlaywrightStateCaptureProvider(),
    lectureRepository,
  );
  const renderSceneClipsUseCase = new RenderSceneClipsUseCase(
    new RemotionSceneClipRenderProvider(),
    clipRepository,
    lectureRepository,
  );
  const concatClipsUseCase = new ConcatClipsUseCase(new FfmpegConcatProvider(), clipRepository);

  return new RunAutomationPipelineUseCase(
    validateLectureUseCase,
    narrationAudioPreparationService,
    mergeAudioUseCase,
    syncPlaywrightUseCase,
    reverseSyncPlaywrightUseCase,
    captureScreenshotUseCase,
    recordVisualUseCase,
    captureSharedLiveDemoSessionsUseCase,
    renderSceneClipsUseCase,
    concatClipsUseCase,
  );
}
