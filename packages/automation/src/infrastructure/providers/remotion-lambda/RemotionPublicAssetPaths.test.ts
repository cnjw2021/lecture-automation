import * as path from 'path';
import { config } from '../../config';
import { RemotionPublicAssetPaths } from './RemotionPublicAssetPaths';

describe('RemotionPublicAssetPaths', () => {
  const assetPaths = new RemotionPublicAssetPaths();

  it('builds audio asset paths from one source of truth', () => {
    expect(assetPaths.audio('01-03', 28)).toEqual({
      localPath: path.join(config.paths.audio, '01-03', 'scene-28.wav'),
      publicPath: 'audio/01-03/scene-28.wav',
      required: true,
    });
  });

  it('builds shared state capture public paths', () => {
    expect(assetPaths.stateCaptureFile(
      '01-03',
      'claude-salon-demo',
      28,
      '/tmp/step-0.png',
      'step-0.png',
    )).toEqual({
      localPath: '/tmp/step-0.png',
      publicPath: 'state-captures/01-03/session-claude-salon-demo/scene-28/step-0.png',
      required: true,
    });
  });

  it('joins S3 site prefix and public path without duplicate slashes', () => {
    expect(assetPaths.toS3Key('/sites/lecture-automation/', '/audio/01-03/scene-28.wav')).toBe(
      'sites/lecture-automation/audio/01-03/scene-28.wav',
    );
  });
});
