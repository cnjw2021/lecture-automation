const { exec } = require('child_process');
const path = require('path');
const config = require('../config');

/**
 * SRP 준수: 최종 영상 렌더링(빌드) 공정만 담당함
 */
class RenderService {
  async render(lectureId) {
    console.log(`\n🎬 최종 MP4 렌더링 시작 (Lecture: ${lectureId})...`);
    
    // Remotion 빌드 명령어 구성
    const remotionDir = path.join(config.paths.root, 'packages/remotion');
    const outPath = path.join(config.paths.root, 'output', `${lectureId}.mp4`);
    
    // 렌더링 명령어 실행 (npm run build 활용)
    const command = `npm run build -w packages/remotion -- --props='{"lecture_id": "${lectureId}"}' ${outPath}`;

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
