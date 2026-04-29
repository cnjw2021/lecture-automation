import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import { Lecture, Scene } from '../../domain/entities/Lecture';
import { IVisualProvider } from '../../domain/interfaces/IVisualProvider';
import { ILectureRepository } from '../../domain/interfaces/ILectureRepository';
import { IAudioDurationProbe } from '../../domain/interfaces/IAudioDurationProbe';
import { RecordVisualUseCase } from './RecordVisualUseCase';

/**
 * #141 F-2: post-recording 검증.
 *
 * RecordVisualUseCase 가 capture 완료 직후 manifest.totalDurationMs 와 audio
 * 길이를 비교해 큰 차이가 있으면 경고를 출력하는지 검증한다.
 */
describe('RecordVisualUseCase F-2 post-recording validation', () => {
  let tmpDir: string;
  let logs: string[];
  let warnSpy: jest.SpyInstance;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'rec-vis-uc-'));
    logs = [];
    warnSpy = jest.spyOn(console, 'warn').mockImplementation((msg: any) => {
      logs.push(String(msg));
    });
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(async () => {
    warnSpy.mockRestore();
    jest.restoreAllMocks();
    await fs.remove(tmpDir);
  });

  function makeLecture(scene: Scene): Lecture {
    return {
      lecture_id: 'lecture-test',
      metadata: { title: 't', part: 1, totalDurationSec: 30 } as any,
      sequence: [scene],
    } as Lecture;
  }

  function makeForwardSyncScene(durationSec = 30): Scene {
    return {
      scene_id: 1,
      narration: 'これはテスト用の短いナレーションです。実際の音声と同期される必要があります。',
      durationSec,
      visual: {
        type: 'playwright',
        action: [
          { cmd: 'goto', url: 'https://example.com' },
          { cmd: 'mouse_move', selector: '#a' },
          { cmd: 'click', selector: '#a' },
          { cmd: 'type', selector: '#a', key: 'hello' },
        ],
        syncPoints: [
          { actionIndex: 3, phrase: '実際の音声' },
        ],
      },
    } as any;
  }

  function makeRepo(): ILectureRepository {
    return {
      getCapturePath: (lectureId: string, sceneId: number) =>
        path.join(tmpDir, 'captures', lectureId, `scene-${sceneId}.webm`),
      getAudioPath: (lectureId: string, sceneId: number) =>
        path.join(tmpDir, 'audio', lectureId, `scene-${sceneId}.wav`),
      existsCapture: async (_lectureId: string, _sceneId: number) => false,
      getAlignmentPath: () => '',
      getAlignment: async () => null,
      getChunkAlignmentPath: () => '',
    } as any;
  }

  function makeProvider(manifestDurationMs: number): IVisualProvider {
    return {
      record: jest.fn(async (scene: Scene, outputPath: string) => {
        await fs.ensureDir(path.dirname(outputPath));
        await fs.writeFile(outputPath, 'webm-stub');
        const manifestPath = outputPath.replace(/\.\w+$/, '.manifest.json');
        await fs.writeJson(manifestPath, {
          sceneId: scene.scene_id,
          totalDurationMs: manifestDurationMs,
          actionTimestamps: [],
        });
      }),
    } as any;
  }

  it('manifest 와 audio 차이가 500ms 이내면 경고 없음', async () => {
    const probe: IAudioDurationProbe = { probeDurationMs: async () => 30000 };
    const repo = makeRepo();
    const useCase = new RecordVisualUseCase(makeProvider(30200), repo, undefined, probe);
    await useCase.execute(makeLecture(makeForwardSyncScene()));
    expect(logs.filter(m => m.includes('[F-2'))).toHaveLength(0);
  });

  it('차이가 600ms 면 warning 출력', async () => {
    const probe: IAudioDurationProbe = { probeDurationMs: async () => 30000 };
    const repo = makeRepo();
    const useCase = new RecordVisualUseCase(makeProvider(30600), repo, undefined, probe);
    await useCase.execute(makeLecture(makeForwardSyncScene()));
    const f2Warnings = logs.filter(m => m.includes('[F-2'));
    expect(f2Warnings).toHaveLength(1);
    expect(f2Warnings[0]).toContain('[F-2 warning]');
    expect(f2Warnings[0]).toContain('+0.60s');
  });

  it('차이가 1500ms 면 critical 출력', async () => {
    const probe: IAudioDurationProbe = { probeDurationMs: async () => 30000 };
    const repo = makeRepo();
    const useCase = new RecordVisualUseCase(makeProvider(31500), repo, undefined, probe);
    await useCase.execute(makeLecture(makeForwardSyncScene()));
    const f2 = logs.filter(m => m.includes('[F-2'));
    expect(f2).toHaveLength(1);
    expect(f2[0]).toContain('[F-2 critical]');
    expect(f2[0]).toContain('webm 이 audio 보다 길게');
  });

  it('webm 이 audio 보다 짧을 때도 검출', async () => {
    const probe: IAudioDurationProbe = { probeDurationMs: async () => 32000 };
    const repo = makeRepo();
    const useCase = new RecordVisualUseCase(makeProvider(30000), repo, undefined, probe);
    await useCase.execute(makeLecture(makeForwardSyncScene()));
    const f2 = logs.filter(m => m.includes('[F-2'));
    expect(f2).toHaveLength(1);
    expect(f2[0]).toContain('webm 이 audio 보다 짧게');
    expect(f2[0]).toContain('-2.00s');
  });

  it('audio 가 아직 없으면 검증 생략', async () => {
    const probe: IAudioDurationProbe = { probeDurationMs: async () => null };
    const repo = makeRepo();
    const useCase = new RecordVisualUseCase(makeProvider(60000), repo, undefined, probe);
    await useCase.execute(makeLecture(makeForwardSyncScene()));
    expect(logs.filter(m => m.includes('[F-2'))).toHaveLength(0);
  });

  it('IAudioDurationProbe 미주입 시 검증 생략 (구버전 호환)', async () => {
    const repo = makeRepo();
    const useCase = new RecordVisualUseCase(makeProvider(60000), repo);
    await useCase.execute(makeLecture(makeForwardSyncScene()));
    expect(logs.filter(m => m.includes('[F-2'))).toHaveLength(0);
  });

  it('순방향 싱크 대상이 아닌 씬은 검증 생략 (syncPoints 없음)', async () => {
    const probe: IAudioDurationProbe = { probeDurationMs: async () => 30000 };
    const repo = makeRepo();
    const scene = makeForwardSyncScene();
    (scene.visual as any).syncPoints = [];
    const useCase = new RecordVisualUseCase(makeProvider(60000), repo, undefined, probe);
    await useCase.execute(makeLecture(scene));
    expect(logs.filter(m => m.includes('[F-2'))).toHaveLength(0);
  });
});
