import { STTFinding } from '../interfaces/ISTTProvider';

/**
 * 時系列に並ぶ finding を指定 window 秒内でグルーピングし、各グループの先頭のみ残す。
 *
 * 用途:
 *  - Provider 層: 1 回の audit 結果で、連続誤読による cascade false positive を除去
 *  - UseCase 層: 複数 runs のマージ結果で、同一誤読の重複を除去
 *
 * 入力順を問わないように必ず timeSec 昇順にソートしてから走査する。
 */
export function groupFindingsByWindow(findings: STTFinding[], windowSec = 2.0): STTFinding[] {
  if (findings.length <= 1) return [...findings];
  const sorted = [...findings].sort((a, b) => a.timeSec - b.timeSec);
  const result: STTFinding[] = [];
  let groupEnd = -Infinity;
  for (const f of sorted) {
    if (f.timeSec > groupEnd) {
      result.push(f);
      groupEnd = f.timeSec + windowSec;
    }
  }
  return result;
}
