import { ValidateLectureUseCase } from './ValidateLectureUseCase';
import { Lecture } from '../../domain/entities/Lecture';

function makeLecture(stylePreset?: string): Lecture {
  return {
    lecture_id: 'test',
    metadata: {
      title: 'Test',
      target_duration: '10',
      target_audience: 'test',
    },
    sequence: [
      {
        scene_id: 1,
        narration: 'テスト',
        visual: {
          type: 'remotion',
          component: 'KeyPointScreen',
          ...(stylePreset ? { stylePreset } : {}),
          props: {
            headline: 'テスト',
          },
        },
      },
    ],
  } as Lecture;
}

describe('ValidateLectureUseCase visual style preset validation', () => {
  let logSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    logSpy.mockRestore();
    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('allows missing stylePreset for backward compatibility', () => {
    expect(() => new ValidateLectureUseCase().execute(makeLecture())).not.toThrow();
  });

  it('allows a supported stylePreset', () => {
    expect(() => new ValidateLectureUseCase().execute(makeLecture('code-focus'))).not.toThrow();
  });

  it('rejects an unknown stylePreset', () => {
    expect(() => new ValidateLectureUseCase().execute(makeLecture('chalkboard'))).toThrow(
      'Unsupported visual style preset: chalkboard',
    );
  });
});
