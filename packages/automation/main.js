const fs = require('fs-extra');
const path = require('path');
const config = require('./src/config');
const ProviderFactory = require('./src/factory/ProviderFactory');
const PlaywrightVisualProvider = require('./src/providers/PlaywrightVisualProvider');
const LectureRepository = require('./src/repositories/LectureRepository');
const AudioService = require('./src/services/AudioService');
const VisualService = require('./src/services/VisualService');
const RenderService = require('./src/services/RenderService');

async function runAutomation(jsonFileName) {
  // 0. 사전 검사 (API 키 확인)
  if (!config.providers.gemini.apiKey || config.providers.gemini.apiKey === 'YOUR_GEMINI_API_KEY_HERE') {
    console.error('\n❌ [에러] GEMINI_API_KEY가 설정되어 있지 않습니다.');
    console.error('루트 디렉토리의 .env 파일에 올바른 API 키를 입력해 주세요.\n');
    process.exit(1);
  }

  const forceRegenerate = process.env.FORCE === '1';
  if (forceRegenerate) {
    console.log('🔄 강제 재생성 모드 활성화 - 기존 에셋을 무시합니다.');
  }

  console.log('🚀 강의 자동화 파이프라인 가동 (Full-Cycle)...');

  // 1. 필요한 의존성 준비 (Composition Root)
  const audioProvider = ProviderFactory.createAudioProvider(
    config.active_audio_provider, 
    config.providers[config.active_audio_provider]
  );
  const visualProvider = new PlaywrightVisualProvider();

  // 2. 서비스 생성 (DIP 준수: 모든 의존성 주입)
  const audioService = new AudioService(audioProvider, LectureRepository);
  const visualService = new VisualService(visualProvider, LectureRepository);

  // 3. 강의 데이터 로드
  const filePath = path.join(config.paths.data, jsonFileName);
  const rawData = await fs.readFile(filePath, 'utf8');
  const lectureData = JSON.parse(rawData);

  // 4. 순차적 공정 실행 (오디오 -> 비주얼 -> 렌더링)
  try {
    console.log('\n--- 1단계: 나레이션 오디오 생성 ---');
    await audioService.processLecture(lectureData, { force: forceRegenerate });

    console.log('\n--- 2단계: 시각 자료(브라우저) 녹화 ---');
    await visualService.processLecture(lectureData, { force: forceRegenerate });

    // 5. 최종 렌더링 자동 실행 (Full Automation의 완성!)
    console.log('\n--- 3단계: 최종 동영상(MP4) 빌드 ---');
    await RenderService.render(lectureData.lecture_id);

    console.log('\n✨ [완료] 전 공정이 성공적으로 마무리되었습니다!');
    console.log(`📍 최종 결과물: output/${lectureData.lecture_id}.mp4`);
  } catch (error) {
    console.error('\n❌ [자동화 중단] 치명적인 오류가 발생하여 공정을 중단합니다.');
    process.exit(1);
  }
}

if (require.main === module) {
  const file = process.argv[2] || 'p1-01-01.json';
  runAutomation(file).catch(console.error);
}
