#!/usr/bin/env node
/**
 * sync-preview CLI
 *
 * Playwright 씬의 sync 결과를 webm 녹화·Lambda 렌더 없이 사전 시뮬레이션한다.
 * 각 action 의 시작 시각 + 그 시점의 narration 발췌 + topic drift 를 출력해
 * syncPoint 적절성을 0.5 초 안에 판정 가능하게 한다.
 *
 * 사용법:
 *   node dist/presentation/cli/sync-preview.js LECTURE.json
 *   node dist/presentation/cli/sync-preview.js LECTURE.json 17
 *   node dist/presentation/cli/sync-preview.js LECTURE.json 15 17
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import { Lecture, Scene, PlaywrightVisual } from '../../domain/entities/Lecture';
import {
  simulateSceneSync,
  SceneSimulationResult,
  SimulationOptions,
  TimingMethod,
} from '../../domain/playwright/PlaywrightSyncSimulator';
import { isForwardSyncTarget, isIsolatedLiveDemoScene } from '../../domain/policies/LiveDemoScenePolicy';

const DRIFT_WARN_MS = 3000;

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.length < 1) {
    console.error('Usage: sync-preview <lecture.json> [scene_id ...]');
    process.exit(1);
  }

  const lectureFile = args[0];
  const sceneIds = args.slice(1).map(s => Number.parseInt(s, 10)).filter(n => Number.isInteger(n) && n > 0);

  const lecturePath = path.resolve(process.cwd(), 'data', lectureFile);
  if (!(await fs.pathExists(lecturePath))) {
    console.error(`❌ 강의 JSON 없음: ${lecturePath}`);
    process.exit(1);
  }

  const lecture: Lecture = await fs.readJson(lecturePath);
  const targets = sceneIds.length > 0
    ? lecture.sequence.filter(s => sceneIds.includes(s.scene_id))
    : lecture.sequence;

  if (targets.length === 0) {
    console.error('❌ 대상 씬 없음 (scene_id 확인)');
    process.exit(1);
  }

  console.log(`\n🔍 sync-preview: ${lecture.lecture_id} (${targets.length} 씬)\n`);

  let totalDriftIssues = 0;
  let totalWarnings = 0;
  let processedScenes = 0;

  for (const scene of targets) {
    if (scene.visual.type !== 'playwright') {
      if (sceneIds.length > 0) {
        console.log(`  ⏭  Scene ${scene.scene_id}: Playwright 씬 아님 (skip)`);
      }
      continue;
    }
    if (isIsolatedLiveDemoScene(scene)) {
      console.log(`  ⏭  Scene ${scene.scene_id}: isolated 라이브 데모 (역방향 싱크 대상, skip)`);
      continue;
    }
    if (!isForwardSyncTarget(scene)) {
      console.log(`  ⏭  Scene ${scene.scene_id}: 순방향 싱크 대상 아님 (skip)`);
      continue;
    }

    const simOptions = await buildSimulationOptions(scene, lecture.lecture_id);
    const result = simulateSceneSync(scene, simOptions);
    if (!result.applicable) {
      console.log(`  ⏭  Scene ${scene.scene_id}: ${result.skipReason ?? 'simulator 적용 불가'}`);
      continue;
    }

    processedScenes++;
    const issues = printSceneReport(scene, result);
    totalDriftIssues += issues.driftCount;
    totalWarnings += result.warnings.length;
  }

  console.log('\n━━━ 요약 ━━━');
  console.log(`  처리된 씬: ${processedScenes}`);
  console.log(`  drift > ${DRIFT_WARN_MS}ms 의심 액션: ${totalDriftIssues}`);
  console.log(`  segment 경고: ${totalWarnings}`);

  if (totalDriftIssues > 0 || totalWarnings > 0) {
    console.log(`\n💡 drift 가 큰 액션은 syncPoint 추가/조정으로 narration 과 정렬 가능합니다.`);
  } else if (processedScenes > 0) {
    console.log(`\n✅ 명확한 drift/경고 없음`);
  }
}

async function buildSimulationOptions(scene: Scene, lectureId: string): Promise<SimulationOptions> {
  const visual = scene.visual as PlaywrightVisual;
  const syncPoints = visual.syncPoints ?? [];
  if (syncPoints.length === 0) return {};

  // alignment.json 기반 정확 타이밍 시도
  const alignmentPath = path.resolve(
    process.cwd(),
    'packages/remotion/public/audio',
    lectureId,
    `scene-${scene.scene_id}.alignment.json`,
  );

  if (!(await fs.pathExists(alignmentPath))) {
    return { timingMethodHint: 'char-count' };
  }

  try {
    const alignment = await fs.readJson(alignmentPath);
    const chars: string[] | undefined = alignment.characters;
    const startTimes: number[] | undefined = alignment.character_start_times_seconds;
    const endTimes: number[] | undefined = alignment.character_end_times_seconds;
    if (
      !Array.isArray(chars) ||
      !Array.isArray(startTimes) ||
      !Array.isArray(endTimes) ||
      chars.length === 0 ||
      chars.length !== startTimes.length ||
      chars.length !== endTimes.length
    ) {
      return { timingMethodHint: 'char-count' };
    }

    const concat = chars.join('');
    const totalMs = Math.max(0, Math.round(endTimes[endTimes.length - 1] * 1000));
    const phraseTimings = new Map<number, number>();

    for (const sp of syncPoints) {
      const pos = concat.indexOf(sp.phrase);
      if (pos < 0) continue;
      const ms = Math.max(0, Math.round(startTimes[pos] * 1000));
      phraseTimings.set(sp.actionIndex, ms);
    }

    return { phraseTimings, totalMsOverride: totalMs, timingMethodHint: 'alignment' };
  } catch {
    return { timingMethodHint: 'char-count' };
  }
}

function printSceneReport(scene: Scene, result: SceneSimulationResult): { driftCount: number } {
  const lines: string[] = [];
  const totalSec = (result.totalDurationMs / 1000).toFixed(1);
  const methodLabel = methodTag(result.timingMethod);
  lines.push(`\n━━━ Scene ${scene.scene_id} (총 ${totalSec}s, ${methodLabel}) ━━━`);
  lines.push(`  narration: "${scene.narration.slice(0, 60)}${scene.narration.length > 60 ? '...' : ''}"`);
  lines.push(`  syncPoints: ${result.syncPoints.length}개`);
  for (const sp of result.syncPoints) {
    lines.push(`    └ actionIndex=${sp.actionIndex} phrase="${sp.phrase}"`);
  }
  lines.push('');

  const driftAlerts: { idx: number; cmd: string; topic: string; mentionMs: number; startMs: number; driftMs: number }[] = [];

  for (const a of result.actions) {
    const idxStr = String(a.index).padStart(2, '0');
    const cmdStr = a.cmd.padEnd(20, ' ');
    const startStr = (a.startMs / 1000).toFixed(1).padStart(6, ' ');
    const offMark = a.isOffscreen ? ' [OFF]' : '';
    const ctxStr = a.narrationContext ? `"${a.narrationContext}..."` : '(끝)';
    const waitMark = a.isWait ? ` (wait ${(a.durationMs / 1000).toFixed(1)}s)` : '';
    let line = `  [${idxStr}] ${cmdStr} ${startStr}s${offMark}   ${ctxStr}${waitMark}`;
    lines.push(line);

    if (
      a.topic !== undefined &&
      a.topicMentionedAtMs !== undefined &&
      a.topicDriftMs !== undefined &&
      a.topicDriftMs > DRIFT_WARN_MS
    ) {
      const driftSec = (a.topicDriftMs / 1000).toFixed(1);
      const mentionSec = (a.topicMentionedAtMs / 1000).toFixed(1);
      lines.push(
        `       ⚠️  drift ${driftSec}s — narration 「${a.topic.slice(0, 30)}${a.topic.length > 30 ? '...' : ''}」 가 ${mentionSec}s 부근에 언급됨. syncPoint actionIndex=${a.index} 추가 검토`,
      );
      driftAlerts.push({
        idx: a.index,
        cmd: a.cmd,
        topic: a.topic,
        mentionMs: a.topicMentionedAtMs,
        startMs: a.startMs,
        driftMs: a.topicDriftMs,
      });
    }
  }

  if (result.warnings.length > 0) {
    lines.push('');
    lines.push('  📋 segment 경고:');
    for (const w of result.warnings) {
      lines.push(`    - ${w}`);
    }
  }

  console.log(lines.join('\n'));
  return { driftCount: driftAlerts.length };
}

function methodTag(method: TimingMethod): string {
  switch (method) {
    case 'alignment':
      return 'alignment.json 기반';
    case 'wav-analysis':
      return 'WAV 묵음 분석';
    case 'char-count':
    default:
      return 'char-count 추산';
  }
}

main().catch(err => {
  console.error('❌ sync-preview 실패:', err);
  process.exit(1);
});
