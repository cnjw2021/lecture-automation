export interface MasterAudioGeneratorDescriptor {
  provider: string;
  modelName: string;
  voiceName: string;
  styleVersion: string;
  promptHash: string;
  temperature?: number;
  seed?: number;
}

export interface MasterAudioManifest {
  version: 1;
  lectureId: string;
  sourceJson: string;
  sceneCount: number;
  scriptHash: string;
  scriptLength: number;
  generator: MasterAudioGeneratorDescriptor;
  generatedAt: string;
}
