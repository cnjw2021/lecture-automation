import * as path from 'path';

export function resolveDefaultAlignmentPath(rootDir: string, jsonFileName: string): string {
  const lectureStem = path.basename(jsonFileName, path.extname(jsonFileName));
  return path.join(rootDir, 'tmp', 'audio-segmentation', lectureStem, 'alignment.json');
}

export function resolveMasterAudioPath(rootDir: string, jsonFileName: string, env: NodeJS.ProcessEnv = process.env): string {
  if (env.MASTER_AUDIO) {
    return path.resolve(env.MASTER_AUDIO);
  }

  const lectureStem = path.basename(jsonFileName, path.extname(jsonFileName));
  return path.join(rootDir, 'input', 'master-audio', lectureStem, 'master.wav');
}

export function resolveAlignmentPath(rootDir: string, jsonFileName: string, env: NodeJS.ProcessEnv = process.env): string {
  const override = env.MASTER_ALIGNMENT || env.ALIGN;
  return override ? path.resolve(override) : resolveDefaultAlignmentPath(rootDir, jsonFileName);
}

export function resolveAlignmentModel(env: NodeJS.ProcessEnv = process.env): string {
  return env.ALIGN_MODEL || env.MODEL || 'small';
}
