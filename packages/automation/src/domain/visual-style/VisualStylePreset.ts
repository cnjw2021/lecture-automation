export const SUPPORTED_VISUAL_STYLE_PRESETS = [
  'concept-calm',
  'code-focus',
  'demo-native',
  'compare-contrast',
  'process-flow',
  'recap-synthesis',
] as const;

export type VisualStylePreset = typeof SUPPORTED_VISUAL_STYLE_PRESETS[number];

export function isSupportedVisualStylePreset(value: string): value is VisualStylePreset {
  return (SUPPORTED_VISUAL_STYLE_PRESETS as readonly string[]).includes(value);
}
