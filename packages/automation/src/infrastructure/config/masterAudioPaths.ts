import * as path from 'path';

export function resolveDefaultAlignmentPath(rootDir: string, jsonFileName: string): string {
  const lectureStem = path.basename(jsonFileName, path.extname(jsonFileName));
  return path.join(rootDir, 'tmp', 'audio-segmentation', lectureStem, 'alignment.json');
}

export function resolveMasterAudioPath(rootDir: string, jsonFileName: string, env: NodeJS.ProcessEnv = process.env): string {
  const masterAudioOverride = env.MASTER_AUDIO?.trim();
  if (masterAudioOverride) {
    return path.resolve(masterAudioOverride);
  }

  const lectureStem = path.basename(jsonFileName, path.extname(jsonFileName));
  return path.join(rootDir, 'input', 'master-audio', lectureStem, 'master.wav');
}

export function resolveMasterAudioManifestPath(masterAudioPath: string): string {
  return path.join(path.dirname(masterAudioPath), 'manifest.json');
}

export function resolveMasterAudioScriptPath(masterAudioPath: string): string {
  return path.join(path.dirname(masterAudioPath), 'script.txt');
}

export function resolveAlignmentPath(rootDir: string, jsonFileName: string, env: NodeJS.ProcessEnv = process.env): string {
  const override = env.MASTER_ALIGNMENT?.trim() || env.ALIGN?.trim();
  return override ? path.resolve(override) : resolveDefaultAlignmentPath(rootDir, jsonFileName);
}

export function resolveAlignmentModel(env: NodeJS.ProcessEnv = process.env): string {
  return env.ALIGN_MODEL?.trim() || env.MODEL?.trim() || 'small';
}
