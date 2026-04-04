import { exec } from 'child_process';
import * as path from 'path';
import * as fs from 'fs-extra';
import { config } from '../config';
import { Lecture } from '../../domain/entities/Lecture';
import { IRenderProvider } from '../../domain/interfaces/IRenderProvider';

export class RemotionRenderProvider implements IRenderProvider {
  async render(lectureId: string, lectureData: Lecture): Promise<void> {
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
      const child = exec(command, (error, stdout, stderr) => {
        // 임시 파일 정리
        fs.removeSync(propsPath);

        if (error) {
          console.error(`❌ 렌더링 실패: ${error.message}`);
          return reject(error);
        }
        console.log('✅ 렌더링이 완료되었습니다!');
        console.log(`📍 결과물 경로: ${outPath}`);
        resolve();
      });

      if (child.stdout) {
        let lastLoggedRendered = -100;
        child.stdout.on('data', (data) => {
          const text = data.trim();
          if (!text) return;

          // "Rendered N/Total" 패턴 — 100프레임마다 출력
          const renderMatch = text.match(/Rendered\s+(\d+)\/(\d+)/);
          if (renderMatch) {
            const current = parseInt(renderMatch[1], 10);
            const total = parseInt(renderMatch[2], 10);
            if (current === 0 || current === total || current - lastLoggedRendered >= 100) {
              lastLoggedRendered = current;
              console.log(`  > ${text}`);
            }
            return;
          }

          // props 덤프나 너무 긴 라인은 생략
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
