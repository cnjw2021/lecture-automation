export interface MasterAudioAlignmentRequest {
  lecturePath: string;
  masterAudioPath: string;
  outputPath: string;
  modelName: string;
}

export interface IMasterAudioAlignmentProvider {
  generateAlignment(request: MasterAudioAlignmentRequest): Promise<void>;
}
