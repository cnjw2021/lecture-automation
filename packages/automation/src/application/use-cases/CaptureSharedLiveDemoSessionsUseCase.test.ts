import * as path from 'path';
import { CaptureSharedLiveDemoSessionsUseCase } from './CaptureSharedLiveDemoSessionsUseCase';
import {
  ISharedVisualSessionProvider,
  SharedVisualSessionHandle,
} from '../../domain/interfaces/ISharedVisualSessionProvider';
import { ILectureRepository } from '../../domain/interfaces/ILectureRepository';
import { Lecture, Scene } from '../../domain/entities/Lecture';

// ---------------------------------------------------------------------------
// fs-extra mock
// ---------------------------------------------------------------------------

const mockPathExists = jest.fn<Promise<boolean>, [string]>();

jest.mock('fs-extra', () => ({
  ...jest.requireActual('fs-extra'),
  pathExists: (p: string) => mockPathExists(p),
}));

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

function makeSharedScene(id: number, sessionId = 'sess-1'): Scene {
  return {
    scene_id: id,
    narration: 'テスト',
    visual: {
      type: 'playwright',
      action: [{ cmd: 'goto', url: 'https://claude.ai/new' }],
      storageState: 'config/auth/claude.json',
      session: { id: sessionId, mode: 'shared' },
    },
  };
}

function makeLecture(...scenes: Scene[]): Lecture {
  return {
    lecture_id: 'test',
    metadata: { title: 'Test', target_duration: '10', target_audience: 'test' },
    sequence: scenes,
  };
}

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

const FAKE_DIR = '/tmp/fake-capture';

function makeRepo(): ILectureRepository {
  return {
    getSessionSceneCaptureDir: (_lid: string, _sid: string, sceneId: number) =>
      path.join(FAKE_DIR, String(sceneId)),
  } as unknown as ILectureRepository;
}

function makeProvider(
  captureImpl: (
    handle: SharedVisualSessionHandle,
    scene: Scene,
    outputDir: string,
    opts?: { replayOnly?: boolean },
  ) => Promise<null>,
): ISharedVisualSessionProvider {
  return {
    openSession: jest.fn().mockResolvedValue({ sessionId: 'sess-1' }),
    captureSceneInSession: jest.fn().mockImplementation(captureImpl),
    closeSession: jest.fn().mockResolvedValue(undefined),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  // 기본: manifest 없음 → capture 모드
  mockPathExists.mockResolvedValue(false);
});

afterEach(() => {
  jest.clearAllMocks();
});

describe('CaptureSharedLiveDemoSessionsUseCase — fail-fast', () => {
  it('replayOnly 씬 실패 시 그룹 중단 (후속 씬 captureSceneInSession 미호출)', async () => {
    // scene 28 manifest exists → replayOnly; scene 29 manifest missing → capture
    mockPathExists.mockImplementation(async (p: string) => p.includes(`/${28}/`));

    const captureImpl = jest.fn().mockImplementation(
      async (_h: SharedVisualSessionHandle, scene: Scene, _dir: string, opts?: { replayOnly?: boolean }) => {
        if (opts?.replayOnly) throw new Error('replay timeout');
        return null;
      },
    );
    const provider = makeProvider(captureImpl);
    const uc = new CaptureSharedLiveDemoSessionsUseCase(provider, makeRepo());

    await expect(
      uc.execute(makeLecture(makeSharedScene(28), makeSharedScene(29)), { force: false }),
    ).rejects.toThrow('replay timeout');

    const calls = (captureImpl as jest.Mock).mock.calls;
    expect(calls).toHaveLength(1);
    expect(calls[0][1].scene_id).toBe(28);
  });

  it('capture 씬 실패 시 그룹 중단 (후속 씬 captureSceneInSession 미호출)', async () => {
    const captureImpl = jest.fn().mockImplementation(
      async (_h: SharedVisualSessionHandle, scene: Scene) => {
        if (scene.scene_id === 28) throw new Error('action failed');
        return null;
      },
    );
    const provider = makeProvider(captureImpl);
    const uc = new CaptureSharedLiveDemoSessionsUseCase(provider, makeRepo());

    await expect(
      uc.execute(makeLecture(makeSharedScene(28), makeSharedScene(29)), { force: true }),
    ).rejects.toThrow('action failed');

    const calls = (captureImpl as jest.Mock).mock.calls;
    expect(calls).toHaveLength(1);
    expect(calls[0][1].scene_id).toBe(28);
  });

  it('실패 시에도 closeSession 호출됨 (리소스 누수 없음)', async () => {
    const provider = makeProvider(async () => { throw new Error('boom'); });
    const uc = new CaptureSharedLiveDemoSessionsUseCase(provider, makeRepo());

    await expect(
      uc.execute(makeLecture(makeSharedScene(28)), { force: true }),
    ).rejects.toThrow('boom');

    expect(provider.closeSession).toHaveBeenCalledTimes(1);
  });

  it('모든 씬 성공 시 씬 수만큼 captureSceneInSession 호출, closeSession 1회', async () => {
    const provider = makeProvider(async () => null);
    const uc = new CaptureSharedLiveDemoSessionsUseCase(provider, makeRepo());

    await uc.execute(makeLecture(makeSharedScene(28), makeSharedScene(29)), { force: true });

    expect(provider.captureSceneInSession).toHaveBeenCalledTimes(2);
    expect(provider.closeSession).toHaveBeenCalledTimes(1);
  });
});
