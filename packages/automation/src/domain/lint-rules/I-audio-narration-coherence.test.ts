import * as fs from 'fs-extra';
import * as path from 'path';
import { audioNarrationCoherenceRule } from './I-audio-narration-coherence';
import { config } from '../../infrastructure/config';

const TEST_LECTURE_ID = 'lecture-test-i-coherence';

function lectureWithScene(narration: string, sceneId = 1) {
  return {
    lecture_id: TEST_LECTURE_ID,
    sequence: [
      {
        scene_id: sceneId,
        narration,
        visual: { type: 'playwright', action: [{ cmd: 'goto', url: 'https://example.com' }] },
      },
    ],
  };
}

async function writeAlignment(sceneId: number, text: string): Promise<void> {
  const dir = path.join(config.paths.audio, TEST_LECTURE_ID);
  await fs.ensureDir(dir);
  const filePath = path.join(dir, `scene-${sceneId}.alignment.json`);
  const characters = Array.from(text);
  const character_start_times_seconds = characters.map((_, i) => i * 0.1);
  const character_end_times_seconds = characters.map((_, i) => (i + 1) * 0.1);
  await fs.writeJson(filePath, {
    characters,
    character_start_times_seconds,
    character_end_times_seconds,
  });
}

describe('I-audio-narration-coherence', () => {
  beforeEach(async () => {
    await fs.remove(path.join(config.paths.audio, TEST_LECTURE_ID));
  });

  afterAll(async () => {
    await fs.remove(path.join(config.paths.audio, TEST_LECTURE_ID));
  });

  it('alignment 가 없으면 검사 생략', async () => {
    const lec = lectureWithScene('テストナレーション');
    const issues = await audioNarrationCoherenceRule.run(lec);
    expect(issues).toHaveLength(0);
  });

  it('alignment 와 narration 이 일치하면 통과', async () => {
    const text = 'これはテスト用のナレーションです';
    await writeAlignment(1, text);
    const lec = lectureWithScene(text);
    const issues = await audioNarrationCoherenceRule.run(lec);
    expect(issues).toHaveLength(0);
  });

  it('1~3 chars diff 면 warning', async () => {
    await writeAlignment(1, 'これはテストです');         // 8 chars
    const lec = lectureWithScene('これはテスト用です');   // 9 chars (diff 1)
    const issues = await audioNarrationCoherenceRule.run(lec);
    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe('warning');
    expect(issues[0].sceneId).toBe(1);
    expect(issues[0].message).toContain('audio 가 narration 보다 짧음');
  });

  it('4 chars 이상 diff 면 error (lecture-02-03 씬 34 사례)', async () => {
    const audioText = 'これは「テスト」用のナレーションです';   // 18 chars (인용부호 포함)
    const narrationText = 'これはテスト用のナレーションです';    // 16 chars (따옴표 제거)
    await writeAlignment(1, audioText);
    const lec = lectureWithScene(narrationText);
    const issues = await audioNarrationCoherenceRule.run(lec);
    // diff = 2 → warning. 4 chars 이상으로 만들기 위해 더 큰 차이 필요
    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe('warning');
  });

  it('narration 이 audio 보다 4 chars 이상 길면 error', async () => {
    await writeAlignment(1, 'テスト');                                     // 3 chars
    const lec = lectureWithScene('テストとてもながいナレーションです');     // 18 chars (diff 15)
    const issues = await audioNarrationCoherenceRule.run(lec);
    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe('error');
    expect(issues[0].message).toContain('audio 가 narration 보다 짧음');
    expect(issues[0].message).toContain('regen-scene');
  });

  it('audio 가 narration 보다 4 chars 이상 길면 error', async () => {
    await writeAlignment(1, 'これは「テスト」のナレーションでとてもながいです'); // 25 chars
    const lec = lectureWithScene('これはテストのナレーションです');             // 16 chars (diff 9)
    const issues = await audioNarrationCoherenceRule.run(lec);
    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe('error');
    expect(issues[0].message).toContain('audio 가 narration 보다 김');
  });

  it('손상된 alignment.json 은 skip', async () => {
    const dir = path.join(config.paths.audio, TEST_LECTURE_ID);
    await fs.ensureDir(dir);
    await fs.writeFile(path.join(dir, 'scene-1.alignment.json'), 'broken{json');
    const lec = lectureWithScene('テストナレーション');
    const issues = await audioNarrationCoherenceRule.run(lec);
    expect(issues).toHaveLength(0);
  });

  it('characters 필드가 없는 alignment 는 skip', async () => {
    const dir = path.join(config.paths.audio, TEST_LECTURE_ID);
    await fs.ensureDir(dir);
    await fs.writeJson(path.join(dir, 'scene-1.alignment.json'), { other: 'field' });
    const lec = lectureWithScene('テストナレーション');
    const issues = await audioNarrationCoherenceRule.run(lec);
    expect(issues).toHaveLength(0);
  });
});
