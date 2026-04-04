import videoConfig from '../../../config/video.json';

const anim = videoConfig.animation;

// --- Types ---

export interface SpringPreset {
  damping: number;
  stiffness: number;
  mass: number;
}

export interface ElementAnim {
  spring?: string | SpringPreset;
  delay?: number;
  distance?: { x?: number; y?: number };
  scale?: [number, number];
  opacity?: [number, number];
  baseDelay?: number | number[];
  staggerInterval?: number;
  frames?: [number, number];
  width?: number;
  fadeFrames?: [number, number];
  fadeDuration?: number;
  extraDelay?: number;
  drawDuration?: number;
  speed?: number;
  range?: [number, number];
}

type AnimationOverrides = {
  [element: string]: Partial<ElementAnim>;
};

// --- Spring resolver ---

const springPresets = anim.spring as Record<string, SpringPreset>;

export function resolveSpring(ref: string | SpringPreset | undefined): SpringPreset {
  if (!ref) return springPresets.default;
  if (typeof ref === 'string') return springPresets[ref] ?? springPresets.default;
  return ref;
}

// --- Config resolver ---

export function getAnimConfig<T extends Record<string, ElementAnim>>(
  componentName: string,
  overrides?: AnimationOverrides,
): T {
  const defaults = (anim as Record<string, unknown>)[componentName] as T | undefined;
  if (!defaults) return {} as T;
  if (!overrides) return { ...defaults };

  const merged = { ...defaults } as Record<string, ElementAnim>;
  for (const key of Object.keys(overrides)) {
    merged[key] = { ...merged[key], ...overrides[key] };
  }
  return merged as T;
}

// --- Per-component typed configs ---

export interface TitleScreenAnim {
  bg: { fadeFrames: [number, number] };
  title: ElementAnim;
  sub: ElementAnim;
  line: { frames: [number, number]; width: number };
}

export interface KeyPointScreenAnim {
  icon: ElementAnim;
  headline: ElementAnim;
  detail: ElementAnim;
  line: { frames: [number, number]; width: number };
}

export interface QuoteScreenAnim {
  quoteMark: ElementAnim;
  text: ElementAnim;
  attribution: ElementAnim;
  line: { frames: [number, number]; width: number };
}

export interface SummaryScreenAnim {
  title: ElementAnim;
  item: ElementAnim;
  check: { delay: number; fadeDuration: number };
}

export interface ComparisonScreenAnim {
  left: ElementAnim;
  right: ElementAnim;
  vs: ElementAnim;
  point: ElementAnim;
}

export interface DiagramScreenAnim {
  title: ElementAnim;
  node: ElementAnim;
  edge: { extraDelay: number; drawDuration: number };
}

export interface ProgressScreenAnim {
  title: ElementAnim;
  step: ElementAnim;
  pulse: { speed: number; range: [number, number] };
}

export interface SceneTransitionAnim {
  enterDuration: number;
  exitDuration: number;
  distances: {
    slideX: number;
    slideY: number;
    zoomScale: [number, number];
    zoomExitScale: [number, number];
  };
}
