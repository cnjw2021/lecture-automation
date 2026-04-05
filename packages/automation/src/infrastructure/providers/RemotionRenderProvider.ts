import { exec } from 'child_process';
import * as path from 'path';
import * as fs from 'fs-extra';
import { config } from '../config';
import { Lecture } from '../../domain/entities/Lecture';
import { IRenderProvider } from '../../domain/interfaces/IRenderProvider';

export class RemotionRenderProvider implements IRenderProvider {
  async render(lectureId: string, lectureData: Lecture): Promise<void> {
    const startTime = Date.now();
    console.log(`\n🎬 최종 MP4 렌더링 시작 (Lecture: ${lectureId})...`);

    const outPath = path.join(config.paths.output, `${lectureId}.mp4`);
    const durationsPath = path.join(config.paths.audio, lectureId, 'durations.json');

    let audioDurations = {};
    if (await fs.pathExists(durationsPath)) {
      audioDurations = await fs.readJson(durationsPath);
    } else {
      console.warn('⚠️ durations.json이 없습니다. 오디오 없이 렌더링을 시도합니다.');
    }

    // props를 임시 파일로 저장하여 커맨드 라인 길이 제한 회피 + 로그 노출 방지
    const propsPath = path.join(config.paths.output, `${lectureId}-props.json`);
    await fs.writeJson(propsPath, { lectureData, audioDurations });

    const command = `npm run build -w packages/remotion -- FullLecture ${outPath} --props="${propsPath}"`;

    console.log(`📍 출력 경로: ${outPath}`);
    console.log(`📊 총 씬 수: ${lectureData.sequence.length}`);

    return new Promise((resolve, reject) => {
      const child = exec(command, { maxBuffer: 1024 * 1024 * 100 }, (error, stdout, stderr) => {
        fs.removeSync(propsPath);

        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        const minutes = Math.floor(Number(elapsed) / 60);
        const seconds = (Number(elapsed) % 60).toFixed(0);

        if (error) {
          console.error(`❌ 렌더링 실패 (${minutes}분 ${seconds}초 경과): ${error.message}`);
          return reject(error);
        }
        console.log(`✅ 렌더링 완료! (소요 시간: ${minutes}분 ${seconds}초)`);
        console.log(`📍 결과물 경로: ${outPath}`);
        resolve();
      });

      if (child.stdout) {
        let lastLoggedRendered = -1000;
        let lastLoggedEncoded = -1000;
        child.stdout.on('data', (data) => {
          const text = data.trim();
          if (!text) return;

          // "Rendered N/Total" — 1000프레임마다 출력
          const renderMatch = text.match(/Rendered\s+(\d+)\/(\d+)/);
          if (renderMatch) {
            const current = parseInt(renderMatch[1], 10);
            const total = parseInt(renderMatch[2], 10);
            if (current === 0 || current === total || current - lastLoggedRendered >= 1000) {
              lastLoggedRendered = current;
              console.log(`  > ${text}`);
            }
            return;
          }

          // "Encoded N/Total" — 1000프레임마다 출력
          const encodeMatch = text.match(/Encoded\s+(\d+)\/(\d+)/);
          if (encodeMatch) {
            const current = parseInt(encodeMatch[1], 10);
            const total = parseInt(encodeMatch[2], 10);
            if (current === 0 || current === total || current - lastLoggedEncoded >= 1000) {
              lastLoggedEncoded = current;
              console.log(`  > ${text}`);
            }
            return;
          }

          // 너무 긴 라인은 truncate
          if (text.length > 300) {
            console.log(`  > ${text.substring(0, 100)}...`);
            return;
          }

          console.log(`  > ${text}`);
        });
      }
    });
  }
}
