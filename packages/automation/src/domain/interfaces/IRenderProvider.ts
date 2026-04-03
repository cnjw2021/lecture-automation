import { Lecture } from '../entities/Lecture';

export interface IRenderProvider {
  render(lectureId: string, lectureData: Lecture): Promise<void>;
}
