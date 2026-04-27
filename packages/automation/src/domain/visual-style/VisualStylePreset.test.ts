import { readFileSync } from 'fs';
import { resolve } from 'path';
import { isSupportedVisualStylePreset, SUPPORTED_VISUAL_STYLE_PRESETS } from './VisualStylePreset';

interface VideoConfigVisualStylePresets {
  defaultPreset: string;
  supportedPresets: string[];
}

function readVideoConfigVisualStylePresets(): VideoConfigVisualStylePresets {
  const videoConfigPath = resolve(__dirname, '../../../../../config/video.json');
  const videoConfig = JSON.parse(readFileSync(videoConfigPath, 'utf8')) as {
    visualStylePresets: VideoConfigVisualStylePresets;
  };

  return videoConfig.visualStylePresets;
}

describe('VisualStylePreset', () => {
  it('accepts all supported visual style preset names', () => {
    for (const preset of SUPPORTED_VISUAL_STYLE_PRESETS) {
      expect(isSupportedVisualStylePreset(preset)).toBe(true);
    }
  });

  it('rejects unknown preset names', () => {
    expect(isSupportedVisualStylePreset('chalkboard')).toBe(false);
    expect(isSupportedVisualStylePreset('code')).toBe(false);
    expect(isSupportedVisualStylePreset('')).toBe(false);
  });

  it('keeps config/video.json supportedPresets aligned with the TypeScript allowlist', () => {
    const { supportedPresets } = readVideoConfigVisualStylePresets();
    expect(supportedPresets).toEqual([...SUPPORTED_VISUAL_STYLE_PRESETS]);
  });

  it('keeps config/video.json defaultPreset inside supportedPresets', () => {
    const { defaultPreset, supportedPresets } = readVideoConfigVisualStylePresets();
    expect(supportedPresets).toContain(defaultPreset);
    expect(isSupportedVisualStylePreset(defaultPreset)).toBe(true);
  });
});
