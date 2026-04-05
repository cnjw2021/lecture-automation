import * as fs from 'fs-extra';
import * as path from 'path';
import { config } from '../../infrastructure/config';
import { FileLectureRepository } from '../../infrastructure/repositories/FileLectureRepository';
import { GeminiAudioProvider } from '../../infrastructure/providers/GeminiAudioProvider';
import { GoogleCloudTtsProvider } from '../../infrastructure/providers/GoogleCloudTtsProvider';
import { GeminiCloudTtsProvider } from '../../infrastructure/providers/GeminiCloudTtsProvider';
import { PlaywrightVisualProvider } from '../../infrastructure/providers/PlaywrightVisualProvider';
import { RemotionRenderProvider } from '../../infrastructure/providers/RemotionRenderProvider';
import { IAudioProvider } from '../../domain/interfaces/IAudioProvider';
import { GenerateAudioUseCase } from '../../application/use-cases/GenerateAudioUseCase';
import { RecordVisualUseCase } from '../../application/use-cases/RecordVisualUseCase';
import { RenderVideoUseCase } from '../../application/use-cases/RenderVideoUseCase';
import { ValidateLectureUseCase } from '../../application/use-cases/ValidateLectureUseCase';
import { CaptureScreenshotUseCase } from '../../application/use-cases/CaptureScreenshotUseCase';
import { PlaywrightScreenshotProvider } from '../../infrastructure/providers/PlaywrightScreenshotProvider';
import { Lecture } from '../../domain/entities/Lecture';

async function runAutomation(jsonFileName: string) {
  const forceRegenerate = process.env.FORCE === '1';
  if (forceRegenerate) {
    console.log('🔄 강제 재생성 모드 활성화 - 기존 에셋을 무시합니다.');
  }

  console.log('🚀 강의 자동화 파이프라인 가동 (Full-Cycle, Clean Architecture)...');

  // 1. Composition Root: Instantiate Dependencies (Infrastructure)
  const lectureRepository = new FileLectureRepository();

  const providerName = config.active_audio_provider;
  let audioProvider: IAudioProvider;

  const videoConfig = config.getVideoConfig();
  const ttsConfig = config.getTtsConfig();
  const audioConfig = {
    sampleRate: videoConfig.audio.sampleRate,
    channels: videoConfig.audio.channels,
    bitDepth: videoConfig.audio.bitDepth,
    speechRate: ttsConfig.speechRate || 0.85,
  };

  if (providerName === 'gemini_cloud_tts') {
    const gcConfig = config.providers.gemini_cloud_tts;
    if (!gcConfig.keyFilePath) {
      console.error('\n❌ [에러] GOOGLE_CLOUD_TTS_KEY_FILE이 설정되어 있지 않습니다.');
      console.error('루트 디렉토리의 .env 파일에 Service Account JSON 키 파일 경로를 입력해 주세요.\n');
      process.exit(1);
    }
    audioProvider = new GeminiCloudTtsProvider(gcConfig.keyFilePath, gcConfig.modelName, gcConfig.voiceName, gcConfig.languageCode, audioConfig);
  } else if (providerName === 'google_cloud_tts') {
    const gcConfig = config.providers.google_cloud_tts;
    if (!gcConfig.keyFilePath) {
      console.error('\n❌ [에러] GOOGLE_CLOUD_TTS_KEY_FILE이 설정되어 있지 않습니다.');
      console.error('루트 디렉토리의 .env 파일에 Service Account JSON 키 파일 경로를 입력해 주세요.\n');
      process.exit(1);
    }
    audioProvider = new GoogleCloudTtsProvider(gcConfig.keyFilePath, gcConfig.voiceName, gcConfig.languageCode, audioConfig);
  } else {
    const geminiConfig = config.providers.gemini;
    if (!geminiConfig.apiKey || geminiConfig.apiKey === 'YOUR_GEMINI_API_KEY_HERE') {
      console.error('\n❌ [에러] GEMINI_API_KEY가 설정되어 있지 않습니다.');
      console.error('루트 디렉토리의 .env 파일에 올바른 API 키를 입력해 주세요.\n');
      process.exit(1);
    }
    audioProvider = new GeminiAudioProvider(geminiConfig.apiKey, geminiConfig.modelName, geminiConfig.voice, geminiConfig.language, audioConfig);
  }

  console.log(`🔊 오디오 프로바이더: ${providerName}`);
  const visualProvider = new PlaywrightVisualProvider();
  const screenshotProvider = new PlaywrightScreenshotProvider();
  const renderProvider = new RemotionRenderProvider();

  // 2. Instantiate Application Use Cases (Application)
  const validateLectureUseCase = new ValidateLectureUseCase();
  const generateAudioUseCase = new GenerateAudioUseCase(audioProvider, lectureRepository);
  const captureScreenshotUseCase = new CaptureScreenshotUseCase(screenshotProvider, lectureRepository);
  const recordVisualUseCase = new RecordVisualUseCase(visualProvider, lectureRepository);
  const renderVideoUseCase = new RenderVideoUseCase(renderProvider);

  // 3. Load Data
  const filePath = path.join(config.paths.data, jsonFileName);
  if (!await fs.pathExists(filePath)) {
    console.error(`\n❌ [에러] 파일을 찾을 수 없습니다: ${filePath}`);
    process.exit(1);
  }
  const rawData = await fs.readFile(filePath, 'utf8');
  const lectureData: Lecture = JSON.parse(rawData);

  // 4. Validate before proceeding (Fail-Fast)
  try {
    validateLectureUseCase.execute(lectureData);
  } catch (error) {
    process.exit(1);
  }

  // 5. Execute Pipeline
  try {
    console.log('\n--- 1단계: 나레이션 오디오 생성 ---');
    await generateAudioUseCase.execute(lectureData, { force: forceRegenerate });

    console.log('\n--- 2단계: 스크린샷 캡처 ---');
    await captureScreenshotUseCase.execute(lectureData, { force: forceRegenerate });

    console.log('\n--- 3단계: 시각 자료(브라우저) 녹화 ---');
    await recordVisualUseCase.execute(lectureData, { force: forceRegenerate });

    console.log('\n--- 4단계: 최종 동영상(MP4) 빌드 ---');
    await renderVideoUseCase.execute(lectureData.lecture_id, lectureData);

    console.log('\n✨ [완료] 전 공정이 성공적으로 마무리되었습니다!');
    console.log(`📍 최종 결과물: ${path.join(config.paths.output, `${lectureData.lecture_id}.mp4`)}`);
  } catch (error) {
    console.error('\n❌ [자동화 중단] 치명적인 오류가 발생하여 공정을 중단합니다.');
    console.error(error);
    process.exit(1);
  }
}

if (require.main === module) {
  const file = process.argv[2] || 'p1-01-01.json';
  runAutomation(file).catch(console.error);
}
