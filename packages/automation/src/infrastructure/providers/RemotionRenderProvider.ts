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

    const props = JSON.stringify({ lectureData, audioDurations });
    const escapedProps = props.replace(/'/g, "'\\''");

    const command = `npm run build -w packages/remotion -- FullLecture ${outPath} --props='${escapedProps}'`;

    return new Promise((resolve, reject) => {
      const process = exec(command, (error, stdout, stderr) => {
        if (error) {
          console.error(`❌ 렌더링 실패: ${error.message}`);
          return reject(error);
        }
        console.log('✅ 렌더링이 완료되었습니다!');
        console.log(`📍 결과물 경로: ${outPath}`);
        resolve();
      });

      if (process.stdout) {
        process.stdout.on('data', (data) => console.log(`  > ${data.trim()}`));
      }
    });
  }
}
