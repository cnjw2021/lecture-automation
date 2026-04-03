import { Lecture } from '../../domain/entities/Lecture';
import { IRenderProvider } from '../../domain/interfaces/IRenderProvider';

export class RenderVideoUseCase {
  constructor(private readonly renderProvider: IRenderProvider) {}

  async execute(lectureId: string, lectureData: Lecture): Promise<void> {
    await this.renderProvider.render(lectureId, lectureData);
  }
}
