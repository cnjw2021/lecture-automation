import * as fs from 'fs-extra';
import * as path from 'path';
import { Lecture } from '../../domain/entities/Lecture';
import { createAutomationPipeline } from '../../infrastructure/composition/createAutomationPipeline';
import { config } from '../../infrastructure/config';

async function loadLecture(jsonFileName: string): Promise<{ lecture: Lecture; lecturePath: string }> {
  const lecturePath = path.join(config.paths.data, jsonFileName);
  if (!await fs.pathExists(lecturePath)) {
    console.error(`\n❌ [에러] 파일을 찾을 수 없습니다: ${lecturePath}`);
    process.exit(1);
  }

  const rawData = await fs.readFile(lecturePath, 'utf8');
  return {
    lecture: JSON.parse(rawData) as Lecture,
    lecturePath,
  };
}

async function runAutomation(jsonFileName: string) {
  const forceRegenerate = process.env.FORCE === '1';
  const useSynthCapture = process.env.SYNTH === '1';
  const ttsOnly = process.env.TTS_ONLY === '1';
  const renderOnly = process.env.RENDER_ONLY === '1';
  const targetSceneIds = parseTargetSceneIds(process.env.TARGET_SCENES);
  const targetChunks = parseTargetChunks(process.env.TARGET_CHUNKS);

  if (forceRegenerate) {
    console.log('🔄 강제 재생성 모드 활성화 - 기존 에셋을 무시합니다.');
  }
  if (useSynthCapture) {
    console.log('🖼️ 상태 합성형 캡처 모드 활성화 - 스크린샷 기반 Playwright 씬 캡처');
  }
  if (ttsOnly) {
    console.log('🔊 TTS_ONLY 모드 활성화 - TTS 생성 후 중단');
  }
  if (renderOnly) {
    console.log('🎞️ RENDER_ONLY 모드 활성화 - 렌더링 전 단계 생략');
  }
  if (targetSceneIds.length > 0) {
    console.log(`🎯 대상 씬 제한 모드 활성화 - Scene ${targetSceneIds.join(', ')}`);
  }
  if (Object.keys(targetChunks).length > 0) {
    const summary = Object.entries(targetChunks)
      .map(([sceneId, chunks]) => `Scene ${sceneId} chunk ${chunks.join(',')}`)
      .join(' / ');
    console.log(`🧩 청크 단위 재생성 모드 활성화 - ${summary}`);
  }

  console.log('🚀 강의 자동화 파이프라인 가동 (Full-Cycle, Clean Architecture)...');

  const { lecture, lecturePath } = await loadLecture(jsonFileName);
  const automationPipeline = createAutomationPipeline();

  try {
    const { outputPath } = await automationPipeline.execute({
      lecture,
      jsonFileName,
      lecturePath,
      forceRegenerate,
      useSynthCapture,
      ttsOnly,
      renderOnly,
      targetSceneIds: targetSceneIds.length > 0 ? targetSceneIds : undefined,
      targetChunks: Object.keys(targetChunks).length > 0 ? targetChunks : undefined,
      persistLecture: async updatedLecture => {
        await fs.writeJson(lecturePath, updatedLecture, { spaces: 2 });
      },
    });

    console.log('\n✨ [완료] 전 공정이 성공적으로 마무리되었습니다!');
    console.log(`📍 최종 결과물: ${outputPath}`);
  } catch (error) {
    console.error('\n❌ [자동화 중단] 치명적인 오류가 발생하여 공정을 중단합니다.');
    console.error(error);
    process.exit(1);
  }
}

function parseTargetSceneIds(raw?: string): number[] {
  if (!raw) return [];

  return raw
    .split(/[,\s]+/)
    .map(value => value.trim())
    .filter(Boolean)
    .map(value => Number.parseFloat(value))
    .filter(value => Number.isFinite(value) && value > 0);
}

/**
 * TARGET_CHUNKS env 파싱. 형식:
 *   "16:0,3,5"              — scene 16 의 청크 0·3·5
 *   "16:0,3,5 17:1"         — 여러 씬 동시 지정 (공백 구분)
 *   "16:0-2"                — range 표기 (0,1,2)
 */
function parseTargetChunks(raw?: string): Record<number, number[]> {
  if (!raw) return {};
  const result: Record<number, number[]> = {};
  for (const token of raw.split(/\s+/).map(t => t.trim()).filter(Boolean)) {
    const [sceneIdRaw, chunkSpec] = token.split(':');
    const sceneId = Number.parseInt(sceneIdRaw, 10);
    if (!Number.isFinite(sceneId) || sceneId <= 0 || !chunkSpec) {
      throw new Error(`TARGET_CHUNKS 파싱 실패: '${token}' (예: '16:0,3,5')`);
    }
    const chunkIndices = new Set<number>();
    for (const spec of chunkSpec.split(',').map(s => s.trim()).filter(Boolean)) {
      const range = spec.match(/^(\d+)-(\d+)$/);
      if (range) {
        const [, fromStr, toStr] = range;
        const from = Number.parseInt(fromStr, 10);
        const to = Number.parseInt(toStr, 10);
        for (let i = from; i <= to; i++) chunkIndices.add(i);
      } else {
        const n = Number.parseInt(spec, 10);
        if (!Number.isFinite(n) || n < 0) {
          throw new Error(`TARGET_CHUNKS 청크 인덱스 파싱 실패: '${spec}'`);
        }
        chunkIndices.add(n);
      }
    }
    result[sceneId] = Array.from(chunkIndices).sort((a, b) => a - b);
  }
  return result;
}

if (require.main === module) {
  const file = process.argv[2] || 'p1-01-01.json';
  runAutomation(file).catch(console.error);
}
