import { exec } from 'child_process';
import * as path from 'path';
import * as fs from 'fs-extra';
import { Lecture } from '../../domain/entities/Lecture';
import { ISceneClipRenderProvider } from '../../domain/interfaces/ISceneClipRenderProvider';
import { ILectureRepository } from '../../domain/interfaces/ILectureRepository';
import { isSharedSessionScene } from '../../domain/policies/LiveDemoScenePolicy';
import { config } from '../config';

export class RemotionSceneClipRenderProvider implements ISceneClipRenderProvider {
  constructor(private readonly lectureRepository: ILectureRepository) {}

  async renderScene(
    lectureId: string,
    sceneId: number,
    outPath: string,
    lectureData: Lecture,
    audioDurations: Record<string, number>
  ): Promise<void> {
    const startTime = Date.now();
    await fs.ensureDir(path.dirname(outPath));

    const synthManifests = await this.loadSynthManifests(lectureId, sceneId, lectureData);

    const propsPath = path.join(config.paths.output, `${lectureId}-scene-${sceneId}-props.json`);
    await fs.ensureDir(path.dirname(propsPath));
    await fs.writeJson(propsPath, { lectureData, audioDurations, sceneId, ...(synthManifests && { synthManifests }) });

    const command = `npm run build -w packages/remotion -- SingleScene "${outPath}" --props="${propsPath}"`;

    return new Promise((resolve, reject) => {
      const child = exec(command, { maxBuffer: 1024 * 1024 * 100 }, (error) => {
        fs.removeSync(propsPath);

        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        if (error) {
          console.error(`    ❌ Scene ${sceneId} 렌더링 실패 (${elapsed}초): ${error.message}`);
          return reject(error);
        }
        console.log(`    ✅ Scene ${sceneId} 완료 (${elapsed}초)`);
        resolve();
      });

      if (child.stdout) {
        let lastLoggedRendered = -1000;
        child.stdout.on('data', (data) => {
          const text = data.trim();
          if (!text) return;

          const renderMatch = text.match(/Rendered\s+(\d+)\/(\d+)/);
          if (renderMatch) {
            const current = parseInt(renderMatch[1], 10);
            const total = parseInt(renderMatch[2], 10);
            if (current === 0 || current === total || current - lastLoggedRendered >= 200) {
              lastLoggedRendered = current;
              console.log(`      > ${text}`);
            }
          }
        });
      }
    });
  }

  private async loadSynthManifests(
    lectureId: string,
    sceneId: number,
    lectureData: Lecture,
  ): Promise<Record<string, unknown> | null> {
    const scene = lectureData.sequence.find(s => s.scene_id === sceneId);
    if (!scene || !isSharedSessionScene(scene)) return null;

    const sessionId = (scene.visual as any).session!.id as string;
    const manifestPath = path.join(
      this.lectureRepository.getSessionSceneCaptureDir(lectureId, sessionId, sceneId),
      'manifest.json',
    );

    if (!await fs.pathExists(manifestPath)) {
      console.warn(`    ⚠️  Scene ${sceneId} shared session manifest 없음: ${manifestPath}`);
      return null;
    }

    const manifest = await fs.readJson(manifestPath);
    return { [sceneId.toString()]: manifest };
  }
}
