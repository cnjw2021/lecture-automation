export interface IConcatProvider {
  concat(clipPaths: string[], outputPath: string): Promise<void>;
}
