import { groupFindingsByWindow } from './STTFindingGrouping';
import { STTFinding } from '../interfaces/ISTTProvider';

function f(timeSec: number, actual = 'X', expected = 'Y'): STTFinding {
  return { timeSec, expected, actual };
}

describe('groupFindingsByWindow', () => {
  it('空配列はそのまま返す', () => {
    expect(groupFindingsByWindow([])).toEqual([]);
  });

  it('1件はそのまま返す', () => {
    const input = [f(1.0)];
    expect(groupFindingsByWindow(input)).toEqual(input);
  });

  it('2秒window内の連続 finding は先頭のみ残す (cascade 抑制)', () => {
    // regression: scene 31 エイチワんち 오독 후 타이밍 경계 이탈로 연쇄 발생한 cascade
    const input = [f(2.3, 'エイチワんち'), f(3.1, '前後'), f(4.2, 'にこの')];
    const out = groupFindingsByWindow(input, 2.0);
    expect(out).toHaveLength(1);
    expect(out[0].actual).toBe('エイチワんち');
  });

  it('2秒windowを超えた finding は別グループとして残す', () => {
    const input = [f(2.3), f(4.31), f(6.35)];
    const out = groupFindingsByWindow(input, 2.0);
    expect(out.map(x => x.timeSec)).toEqual([2.3, 4.31, 6.35]);
  });

  it('入力順が昇順でなくても、先に発生した finding を優先する (regression: sort bug)', () => {
    // Gemini が時刻順で返さないケース — 5.0 を先に受け取っても 2.3 が失われてはいけない
    const input = [f(5.0, '後半'), f(2.3, '前半')];
    const out = groupFindingsByWindow(input, 2.0);
    expect(out).toHaveLength(2);
    expect(out[0].timeSec).toBe(2.3);
    expect(out[1].timeSec).toBe(5.0);
  });

  it('window 境界 (timeSec === groupEnd) は同一グループ扱い', () => {
    // 2.3 + 2.0 = 4.3 === 4.3 → まだグループ内
    const input = [f(2.3), f(4.3)];
    const out = groupFindingsByWindow(input, 2.0);
    expect(out).toHaveLength(1);
  });

  it('windowSec パラメータを尊重する', () => {
    const input = [f(1.0), f(2.0), f(3.0)];
    expect(groupFindingsByWindow(input, 0.5)).toHaveLength(3);
    expect(groupFindingsByWindow(input, 5.0)).toHaveLength(1);
  });

  it('入力配列を破壊しない', () => {
    const input = [f(5.0), f(2.3)];
    const snapshot = input.map(x => x.timeSec);
    groupFindingsByWindow(input);
    expect(input.map(x => x.timeSec)).toEqual(snapshot);
  });
});
