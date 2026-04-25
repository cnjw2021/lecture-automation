import { Lecture } from '../../domain/entities/Lecture';
import { ILectureRepository } from '../../domain/interfaces/ILectureRepository';
import { SyncPlaywrightUseCase } from './SyncPlaywrightUseCase';

class FakeLectureRepository implements Partial<ILectureRepository> {
  getAudioPath(): string {
    return '/tmp/non-existent-sync-playwright-test.wav';
  }
}

describe('SyncPlaywrightUseCase', () => {
  let logSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    logSpy.mockRestore();
    warnSpy.mockRestore();
  });

  it('does not propagate negative wait.ms during proportional redistribution', async () => {
    const lecture: Lecture = {
      lecture_id: 'sync-playwright-test',
      metadata: {
        title: 'test',
        target_duration: 'test',
        target_audience: 'test',
      },
      sequence: [
        {
          scene_id: 1,
          narration: 'aaaaabbbbb',
          durationSec: 10,
          visual: {
            type: 'playwright',
            action: [
              { cmd: 'wait', ms: -1000 },
              { cmd: 'wait', ms: 2000 },
              { cmd: 'type', selector: '#x', key: 'X' },
            ],
            syncPoints: [{ actionIndex: 2, phrase: 'bbbbb' }],
          },
        },
      ],
    };

    const useCase = new SyncPlaywrightUseCase(new FakeLectureRepository() as unknown as ILectureRepository);
    const { updatedLecture } = await useCase.execute(lecture);
    const updatedActions = updatedLecture.sequence[0].visual.type === 'playwright'
      ? updatedLecture.sequence[0].visual.action
      : [];

    expect(updatedActions[0].ms).toBe(0);
    expect(updatedActions[1].ms).toBe(5000);
    expect(updatedActions.every(action => action.cmd !== 'wait' || (action.ms ?? 0) >= 0)).toBe(true);
  });
});
