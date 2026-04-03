const fs = require('fs-extra');
const path = require('path');
const config = require('./src/config');
const ProviderFactory = require('./src/factory/ProviderFactory');
const LectureRepository = require('./src/repositories/LectureRepository');
const AudioService = require('./src/services/AudioService');

async function runAutomation(jsonFileName) {
  // 1. 필요한 의존성 준비 (Composition Root)
  const providerSettings = config.providers[config.active_audio_provider];
  const audioProvider = ProviderFactory.createAudioProvider(config.active_audio_provider, providerSettings);
  
  // 2. 서비스 생성 (DIP 준수: 모든 의존성 주입)
  const audioService = new AudioService(audioProvider, LectureRepository);

  // 3. 강의 데이터 로드
  const filePath = path.join(config.paths.data, jsonFileName);
  const rawData = await fs.readFile(filePath, 'utf8');
  const lectureData = JSON.parse(rawData);

  // 4. 실행
  await audioService.processLecture(lectureData);

  console.log('✨ 모든 공정이 Clean Architecture 원칙에 따라 완료되었습니다.');
}

if (require.main === module) {
  const file = process.argv[2] || 'p1-01-01.json';
  runAutomation(file).catch(console.error);
}
