import { IAlignmentReliabilityStrategy } from './IAlignmentReliabilityStrategy';
import { IAudioProvider } from './IAudioProvider';

export interface AudioProviderFactoryResult {
  provider: IAudioProvider;
  providerName: string;
  /** 이 프로바이더의 alignment 신뢰도 특성을 반영한 씬 경계 컷 전략. */
  alignmentReliabilityStrategy: IAlignmentReliabilityStrategy;
}

export interface IAudioProviderFactory {
  create(): AudioProviderFactoryResult;
}
