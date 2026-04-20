import * as fs from 'fs-extra';
import { AuditTTSUseCase } from './AuditTTSUseCase';
import { ISTTProvider, STTSceneAuditResult } from '../../domain/interfaces/ISTTProvider';
import { ILectureRepository } from '../../domain/interfaces/ILectureRepository';
import { Lecture } from '../../domain/entities/Lecture';

jest.mock('fs-extra', () => ({
  pathExists: jest.fn(),
}));

const mockPathExists = fs.pathExists as unknown as jest.Mock;

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeLecture(sceneIds: number[]): Lecture {
  return {
    lecture_id: 'lecture-01-04',
    metadata: { title: 'Test', target_duration: '20', target_audience: 'test' },
    sequence: sceneIds.map(id => ({
      scene_id: id,
      narration: id === 31
        ? 'この「エイチワン」というのは「見出し」を意味するタグです。'
        : `scene ${id} narration`,
      visual: { type: 'remotion', component: 'TitleScreen', props: {} },
    })),
  };
}

class FakeRepo implements Partial<ILectureRepository> {
  getAudioPath(lectureId: string, sceneId: number): string {
    return `/fake/${lectureId}/scene-${sceneId}.wav`;
  }
}

/** ISTTProvider スタブ — 씬 ID → 결과 시나리오 매핑 */
class StubSTTProvider implements ISTTProvider {
  readonly providerName = 'stub';
  private callCounts = new Map<number, number>();

  constructor(
    private readonly scenario: (sceneId: number, callIndex: number) => STTSceneAuditResult | 'throw',
  ) {}

  async audit(_audioPath: string, _narration: string, sceneId: number): Promise<STTSceneAuditResult> {
    const n = this.callCounts.get(sceneId) ?? 0;
    this.callCounts.set(sceneId, n + 1);
    const result = this.scenario(sceneId, n);
    if (result === 'throw') throw new Error(`stub throw scene ${sceneId} call ${n}`);
    return result;
  }

  getCallCount(sceneId: number): number {
    return this.callCounts.get(sceneId) ?? 0;
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AuditTTSUseCase', () => {
  beforeEach(() => {
    mockPathExists.mockReset();
    mockPathExists.mockResolvedValue(true);
  });

  describe('single-run (runs=1)', () => {
    it('통과 씬만 있으면 warning=0, passed=전부', async () => {
      const lecture = makeLecture([1, 2]);
      const provider = new StubSTTProvider(sceneId => ({ sceneId, passed: true, findings: [] }));
      const usecase = new AuditTTSUseCase(provider, new FakeRepo() as ILectureRepository);

      const report = await usecase.execute(lecture);

      expect(report.passedScenes).toBe(2);
      expect(report.warningScenes).toBe(0);
      expect(report.errorScenes).toBe(0);
    });

    it('regression: 씬 31 エイチワンチ 오독이 ⚠️ 의심 씬으로 보고된다', async () => {
      const lecture = makeLecture([31]);
      const provider = new StubSTTProvider(sceneId => ({
        sceneId,
        passed: false,
        findings: [{ timeSec: 2.3, expected: 'エイチワン', actual: 'エイチワンチ' }],
      }));
      const usecase = new AuditTTSUseCase(provider, new FakeRepo() as ILectureRepository);

      const report = await usecase.execute(lecture);

      expect(report.warningScenes).toBe(1);
      expect(report.totalFindingCount).toBe(1);
      expect(report.results[0].findings[0].actual).toBe('エイチワンチ');
      expect(report.results[0].hitRuns).toBe(1);
      expect(report.results[0].successRuns).toBe(1);
    });

    it('audio 파일 부재 씬은 skip으로 집계된다', async () => {
      const lecture = makeLecture([1, 2]);
      mockPathExists.mockImplementation(async (p: string) => !p.includes('scene-2.wav'));
      const provider = new StubSTTProvider(sceneId => ({ sceneId, passed: true, findings: [] }));
      const usecase = new AuditTTSUseCase(provider, new FakeRepo() as ILectureRepository);

      const report = await usecase.execute(lecture);

      expect(report.skippedScenes).toBe(1);
      expect(report.auditedScenes).toBe(1);
    });

    it('API throw 시 ❌ 에러 씬으로 기록되고 계속 진행한다', async () => {
      const lecture = makeLecture([1, 2]);
      const provider = new StubSTTProvider((sceneId) => sceneId === 1 ? 'throw' : { sceneId, passed: true, findings: [] });
      const usecase = new AuditTTSUseCase(provider, new FakeRepo() as ILectureRepository);

      const report = await usecase.execute(lecture);

      expect(report.errorScenes).toBe(1);
      expect(report.passedScenes).toBe(1);
      expect(report.results[0].passed).toBe('error');
    });
  });

  describe('majority-vote (runs > 1)', () => {
    it('2회 실행에서 1회라도 finding 발견되면 ⚠️ 의심 판정 (false negative 억제)', async () => {
      const lecture = makeLecture([31]);
      let call = 0;
      const provider = new StubSTTProvider(sceneId => {
        call++;
        if (call === 1) return { sceneId, passed: true, findings: [] };
        return { sceneId, passed: false, findings: [{ timeSec: 2.3, expected: 'エイチワン', actual: 'エイチワンチ' }] };
      });
      const usecase = new AuditTTSUseCase(provider, new FakeRepo() as ILectureRepository);

      const report = await usecase.execute(lecture, { runs: 2 });

      expect(report.warningScenes).toBe(1);
      expect(report.results[0].hitRuns).toBe(1);
      expect(report.results[0].successRuns).toBe(2);
    });

    it('2회 모두 동일 finding → dedup으로 1건만 남는다', async () => {
      const lecture = makeLecture([31]);
      const provider = new StubSTTProvider(sceneId => ({
        sceneId,
        passed: false,
        findings: [{ timeSec: 2.3, expected: 'エイチワン', actual: 'エイチワンチ' }],
      }));
      const usecase = new AuditTTSUseCase(provider, new FakeRepo() as ILectureRepository);

      const report = await usecase.execute(lecture, { runs: 2 });

      expect(report.results[0].findings).toHaveLength(1);
      expect(report.results[0].hitRuns).toBe(2);
    });

    it('일부 run이 throw해도 성공한 run이 있으면 집계에 반영되며 successRuns에 실제 성공 횟수가 기록된다', async () => {
      const lecture = makeLecture([31]);
      let call = 0;
      const provider = new StubSTTProvider(sceneId => {
        call++;
        if (call === 1) return 'throw';
        return { sceneId, passed: false, findings: [{ timeSec: 2.3, expected: 'エイチワン', actual: 'エイチワンチ' }] };
      });
      const usecase = new AuditTTSUseCase(provider, new FakeRepo() as ILectureRepository);

      const report = await usecase.execute(lecture, { runs: 2 });

      expect(report.warningScenes).toBe(1);
      expect(report.results[0].successRuns).toBe(1);
      expect(report.results[0].hitRuns).toBe(1);
    });

    it('모든 run이 throw하면 ❌ 에러 씬', async () => {
      const lecture = makeLecture([31]);
      const provider = new StubSTTProvider(() => 'throw');
      const usecase = new AuditTTSUseCase(provider, new FakeRepo() as ILectureRepository);

      const report = await usecase.execute(lecture, { runs: 2 });

      expect(report.errorScenes).toBe(1);
      expect(report.results[0].passed).toBe('error');
    });

    it('runs 간 시간이 가까운 findings는 2초 window로 중복 제거된다', async () => {
      const lecture = makeLecture([31]);
      let call = 0;
      const provider = new StubSTTProvider(sceneId => {
        call++;
        if (call === 1) return { sceneId, passed: false, findings: [{ timeSec: 2.3, expected: 'エイチワン', actual: 'エイチワンチ' }] };
        // 두 번째 run이 약간 다른 타임스탬프로 반환 (Gemini 비결정성)
        return { sceneId, passed: false, findings: [{ timeSec: 2.5, expected: 'エイチワン', actual: 'エイチワんち' }] };
      });
      const usecase = new AuditTTSUseCase(provider, new FakeRepo() as ILectureRepository);

      const report = await usecase.execute(lecture, { runs: 2 });

      // 2.3 과 2.5 는 2초 window 내 → 첫 번째만 남음
      expect(report.results[0].findings).toHaveLength(1);
      expect(report.results[0].findings[0].timeSec).toBe(2.3);
    });
  });

  describe('scene filtering', () => {
    it('sceneIds 지정 시 해당 씬만 감사한다', async () => {
      const lecture = makeLecture([1, 2, 3, 4]);
      const provider = new StubSTTProvider(sceneId => ({ sceneId, passed: true, findings: [] }));
      const usecase = new AuditTTSUseCase(provider, new FakeRepo() as ILectureRepository);

      const report = await usecase.execute(lecture, { sceneIds: [2, 4] });

      expect(report.auditedScenes).toBe(2);
      expect(report.results.map(r => r.sceneId)).toEqual([2, 4]);
    });

    it('excludeSceneIds는 감사 대상에서 제외된다', async () => {
      const lecture = makeLecture([1, 2, 3]);
      const provider = new StubSTTProvider(sceneId => ({ sceneId, passed: true, findings: [] }));
      const usecase = new AuditTTSUseCase(provider, new FakeRepo() as ILectureRepository);

      const report = await usecase.execute(lecture, { excludeSceneIds: [2] });

      expect(report.auditedScenes).toBe(2);
      expect(report.results.map(r => r.sceneId)).toEqual([1, 3]);
    });
  });
});
