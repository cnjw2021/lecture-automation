import { AudioGenerateResult } from './IAudioProvider';
import { MasterAudioGeneratorDescriptor } from '../entities/MasterAudioManifest';

export interface IMasterAudioGenerator {
  getDescriptor(): MasterAudioGeneratorDescriptor;
  generate(script: string): Promise<AudioGenerateResult>;
}
