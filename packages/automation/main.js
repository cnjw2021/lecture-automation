const fs = require('fs-extra');
const path = require('path');
const config = require('./src/config');
const ProviderFactory = require('./src/factory/ProviderFactory');
const PlaywrightVisualProvider = require('./src/providers/PlaywrightVisualProvider');
const LectureRepository = require('./src/repositories/LectureRepository');
const AudioService = require('./src/services/AudioService');
const VisualService = require('./src/services/VisualService');

async function runAutomation(jsonFileName) {
  console.log('🚀 강의 자동화 파이프라인 가동...');

  // 1. 필요한 의존성 준비 (Composition Root)
  const audioProvider = ProviderFactory.createAudioProvider(
    config.active_audio_provider, 
    config.providers[config.active_audio_provider]
  );
  
  // 시각 자료 녹화 제공자 (현재는 Playwright 고정이나, 필요시 Factory화 가능)
  const visualProvider = new PlaywrightVisualProvider();

  // 2. 서비스 생성 (DIP 준수: 모든 의존성 주입)
  const audioService = new AudioService(audioProvider, LectureRepository);
  const visualService = new VisualService(visualProvider, LectureRepository);

  // 3. 강의 데이터 로드
  const filePath = path.join(config.paths.data, jsonFileName);
  const rawData = await fs.readFile(filePath, 'utf8');
  const lectureData = JSON.parse(rawData);

  // 4. 순차적 공정 실행 (오디오 -> 비주얼)
  console.log('\n--- 1단계: 나레이션 오디오 생성 ---');
  await audioService.processLecture(lectureData);

  console.log('\n--- 2단계: 시각 자료(브라우저) 녹화 ---');
  await visualService.processLecture(lectureData);

  console.log('\n✨ [완료] 모든 에셋이 준비되었습니다!');
  console.log('--------------------------------------------------');
  console.log('최종 영상을 렌더링하려면 다음 명령을 실행하세요:');
  console.log(`npm run render -w packages/remotion`);
  console.log('--------------------------------------------------');
}

if (require.main === module) {
  const file = process.argv[2] || 'p1-01-01.json';
  runAutomation(file).catch(console.error);
}
