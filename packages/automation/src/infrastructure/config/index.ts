import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs-extra';

dotenv.config();

const ROOT_DIR = path.join(__dirname, '../../../../../');

export const config = {
  active_audio_provider: 'gemini', 
  
  providers: {
    gemini: {
      apiKey: process.env.GEMINI_API_KEY || '',
      modelName: "gemini-2.5-flash-preview-tts",
    },
  },

  paths: {
    root: ROOT_DIR,
    data: path.join(ROOT_DIR, 'data'),
    audio: path.join(ROOT_DIR, 'packages/remotion/public/audio'),
    captures: path.join(ROOT_DIR, 'packages/remotion/public/captures'),
    output: path.join(ROOT_DIR, 'output'),
  },

  getVideoConfig: () => {
    const videoConfigPath = path.join(ROOT_DIR, 'config/video.json');
    if (fs.existsSync(videoConfigPath)) {
      return fs.readJsonSync(videoConfigPath);
    }
    return { audio: { sampleRate: 24000, channels: 1, bitDepth: 16 }, resolution: { width: 1920, height: 1080 } };
  }
};
