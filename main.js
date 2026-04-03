const fs = require('fs-extra');
const path = require('path');
const config = require('./src/config');
const ProviderFactory = require('./src/factory/ProviderFactory');
const AudioService = require('./src/services/AudioService');

async function runAutomation(jsonFileName) {
  // 1. 설정 확인 (SSoT)
  const providerType = config.active_audio_provider;
  const providerSettings = config.providers[providerType];

  // 2. 팩토리를 통해 프로바이더 생성 (DIP - 구체 클래스를 직접 생성하지 않음)
  const audioProvider = ProviderFactory.createAudioProvider(providerType, providerSettings);

  // 3. 의존성 주입 (Dependency Injection)
  const audioService = new AudioService(audioProvider);

  // 4. 비즈니스 로직 실행
  const filePath = path.join(config.paths.data, jsonFileName);
  const rawData = await fs.readFile(filePath, 'utf8');
  const lectureData = JSON.parse(rawData);

  await audioService.generateFromLecture(lectureData);

  console.log('✅ 강의 자동화 공정이 성공적으로 실행되었습니다.');
}

if (require.main === module) {
  const file = process.argv[2] || 'p1-01-01.json';
  runAutomation(file).catch(console.error);
}
