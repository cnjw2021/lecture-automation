import * as fs from 'fs-extra';
import * as path from 'path';
import { Lecture } from '../../domain/entities/Lecture';
import { MasterAudioGeneratorDescriptor, MasterAudioManifest } from '../../domain/entities/MasterAudioManifest';
import { IMasterAudioGenerator } from '../../domain/interfaces/IMasterAudioGenerator';
import { buildMasterAudioManifest, buildMasterAudioScript } from '../../domain/utils/MasterAudioUtils';

export interface GenerateMasterAudioOptions {
  jsonFileName: string;
  outputPath: string;
  manifestPath: string;
  scriptPath: string;
}

export class GenerateMasterAudioUseCase {
  constructor(private readonly masterAudioGenerator: IMasterAudioGenerator) {}

  getDescriptor(): MasterAudioGeneratorDescriptor {
    return this.masterAudioGenerator.getDescriptor();
  }

  async execute(lecture: Lecture, options: GenerateMasterAudioOptions): Promise<MasterAudioManifest> {
    const script = buildMasterAudioScript(lecture);
    const { buffer } = await this.masterAudioGenerator.generate(script);
    const manifest = buildMasterAudioManifest({
      lecture,
      jsonFileName: options.jsonFileName,
      script,
      generator: this.masterAudioGenerator.getDescriptor(),
    });

    await fs.ensureDir(path.dirname(options.outputPath));
    await fs.writeFile(options.outputPath, buffer);
    await fs.writeFile(options.scriptPath, script, 'utf8');
    await fs.writeJson(options.manifestPath, manifest, { spaces: 2 });

    return manifest;
  }
}
