import * as fs from 'fs-extra';
import * as os from 'os';
import * as path from 'path';
import { ILectureRepository } from '../../../domain/interfaces/ILectureRepository';
import { RemotionPublicAssetCollector } from './RemotionPublicAssetCollector';

describe('RemotionPublicAssetCollector', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'asset-collector-'));
  });

  afterEach(async () => {
    await fs.remove(tmpDir);
  });

  it('excludes shared session manifest from S3 upload assets', async () => {
    const sceneDir = path.join(tmpDir, 'scene-28');
    await fs.ensureDir(sceneDir);
    await fs.writeJson(path.join(sceneDir, 'manifest.json'), { sceneId: 28 });
    await fs.writeFile(path.join(sceneDir, 'step-0.png'), 'png');

    const lectureRepository = {
      getSessionSceneCaptureDir: () => sceneDir,
    } as unknown as ILectureRepository;
    const collector = new RemotionPublicAssetCollector(lectureRepository);

    const assets = await collector.collect([{
      lectureId: '01-03',
      sceneId: 28,
      outPath: '/tmp/scene-28.mp4',
      audioDurations: { '28': 10 },
      lectureData: {
        lecture_id: '01-03',
        metadata: { title: '', target_duration: '', target_audience: '' },
        sequence: [{
          scene_id: 28,
          narration: '',
          visual: {
            type: 'playwright',
            action: [],
            session: { id: 'claude-salon-demo', mode: 'shared' },
          },
        }],
      },
    }]);

    expect(assets.map(asset => asset.publicPath)).toContain(
      'state-captures/01-03/session-claude-salon-demo/scene-28/step-0.png',
    );
    expect(assets.map(asset => asset.publicPath)).not.toContain(
      'state-captures/01-03/session-claude-salon-demo/scene-28/manifest.json',
    );
  });
});
