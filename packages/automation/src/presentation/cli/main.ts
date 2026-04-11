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
  const targetSceneIds = parseTargetSceneIds(process.env.TARGET_SCENES);

  if (forceRegenerate) {
    console.log('🔄 강제 재생성 모드 활성화 - 기존 에셋을 무시합니다.');
  }
  if (useSynthCapture) {
    console.log('🖼️ 상태 합성형 캡처 모드 활성화 - 스크린샷 기반 Playwright 씬 캡처');
  }
  if (targetSceneIds.length > 0) {
    console.log(`🎯 대상 씬 제한 모드 활성화 - Scene ${targetSceneIds.join(', ')}`);
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
      targetSceneIds: targetSceneIds.length > 0 ? targetSceneIds : undefined,
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
    .map(value => Number.parseInt(value, 10))
    .filter(value => Number.isInteger(value) && value > 0);
}

if (require.main === module) {
  const file = process.argv[2] || 'p1-01-01.json';
  runAutomation(file).catch(console.error);
}
