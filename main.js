const fs = require('fs-extra');
const path = require('path');
const config = require('./src/config');
const AudioService = require('./src/services/AudioService');

async function runAutomation(jsonFileName) {
  const filePath = path.join(config.paths.data, jsonFileName);
  const rawData = await fs.readFile(filePath, 'utf8');
  const lectureData = JSON.parse(rawData);

  // 1. 오디오 생성 서비스 호출
  await AudioService.generateFromLecture(lectureData);

  // 2. 녹화 서비스 및 렌더링 호출 (동일한 서비스화 작업 가능)
  console.log('✅ 강의 자동화 공정이 완료되었습니다.');
}

if (require.main === module) {
  const file = process.argv[2] || 'p1-01-01.json';
  runAutomation(file).catch(console.error);
}
