/**
 * CLI: 강의 단위 TTS 마스터 오디오에서 alignment.json 생성
 * 사용법: node align-master-audio.js <lecture.json> <master-audio-path> [output-alignment.json] [model]
 */
import { execFile } from 'child_process';
import * as fs from 'fs-extra';
import * as path from 'path';
import { config } from '../../infrastructure/config';

function runPythonAlignment(lecturePath: string, masterAudioPath: string, outputPath: string, modelName: string): Promise<void> {
  const scriptPath = path.join(config.paths.root, 'scripts', 'generate-alignment.py');
  return new Promise((resolve, reject) => {
    execFile(
      'python3',
      [scriptPath, lecturePath, masterAudioPath, outputPath, '--model', modelName],
      { maxBuffer: 1024 * 1024 * 50 },
      (error, stdout, stderr) => {
        if (stdout.trim()) process.stdout.write(stdout);
        if (stderr.trim()) process.stderr.write(stderr);
        if (error) {
          reject(error);
          return;
        }
        resolve();
      }
    );
  });
}

function resolveDefaultOutput(jsonFileName: string): string {
  const lectureStem = path.basename(jsonFileName, path.extname(jsonFileName));
  return path.join(config.paths.root, 'tmp', 'audio-segmentation', lectureStem, 'alignment.json');
}

async function runAlignMasterAudio(jsonFileName: string, masterAudioPath: string, outputPath?: string, modelName = 'small') {
  const lecturePath = path.join(config.paths.data, jsonFileName);
  if (!await fs.pathExists(lecturePath)) {
    console.error(`❌ 파일을 찾을 수 없습니다: ${lecturePath}`);
    process.exit(1);
  }
  if (!await fs.pathExists(masterAudioPath)) {
    console.error(`❌ 마스터 오디오를 찾을 수 없습니다: ${masterAudioPath}`);
    process.exit(1);
  }

  const resolvedOutputPath = outputPath ? path.resolve(outputPath) : resolveDefaultOutput(jsonFileName);

  console.log(`🧭 마스터 오디오 alignment 생성: ${jsonFileName}`);
  console.log(`   - master: ${masterAudioPath}`);
  console.log(`   - output: ${resolvedOutputPath}`);
  console.log(`   - model : ${modelName}`);

  await runPythonAlignment(lecturePath, masterAudioPath, resolvedOutputPath, modelName);
  console.log('\n✅ alignment.json 생성 완료');
  console.log(`   ${resolvedOutputPath}`);
}

if (require.main === module) {
  const [, , jsonFileName, masterAudioPath, outputPath, modelName] = process.argv;
  if (!jsonFileName || !masterAudioPath) {
    console.error('사용법: node align-master-audio.js <lecture.json> <master-audio-path> [output-alignment.json] [model]');
    process.exit(1);
  }

  runAlignMasterAudio(jsonFileName, masterAudioPath, outputPath, modelName || 'small').catch(error => {
    console.error('\n❌ alignment 생성 실패');
    console.error(error);
    process.exit(1);
  });
}
