const { exec } = require('child_process');
const path = require('path');
const fs = require('fs-extra');
const config = require('../config');

/**
 * SRP 준수: 최종 영상 렌더링(빌드) 공정만 담당함
 */
class RenderService {
  async render(lectureId, lectureData) {
    console.log(`\n🎬 최종 MP4 렌더링 시작 (Lecture: ${lectureId})...`);

    // Remotion 빌드 명령어 구성
    const outPath = path.join(config.paths.root, 'output', `${lectureId}.mp4`);

    // duration 메타데이터 로드
    const durationsPath = path.join(config.paths.audio, lectureId, 'durations.json');
    const audioDurations = await fs.readJson(durationsPath);

    // props를 JSON 문자열로 변환 (특수문자 이스케이프)
    const props = JSON.stringify({ lectureData, audioDurations });
    const escapedProps = props.replace(/'/g, "'\\''");

    // 렌더링 명령어 실행 (ID: FullLecture, Output: outPath)
    const command = `npm run build -w packages/remotion -- FullLecture ${outPath} --props='${escapedProps}'`;

    return new Promise((resolve, reject) => {
      const process = exec(command, (error, stdout, stderr) => {
        if (error) {
          console.error(`❌ 렌더링 실패: ${error.message}`);
          return reject(error);
        }
        console.log('✅ 렌더링이 완료되었습니다!');
        console.log(`📍 결과물 경로: ${outPath}`);
        resolve(stdout);
      });

      // 실시간 로그 출력
      process.stdout.on('data', (data) => console.log(`  > ${data.trim()}`));
    });
  }
}

module.exports = new RenderService();
