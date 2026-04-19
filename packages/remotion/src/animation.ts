import videoConfig from '../../../config/video.json';

const templateName = videoConfig.activeTemplate ?? 'warm-cream';
const template = (videoConfig.templates as Record<string, any>)[templateName];
const anim = template.animation;
const FPS = videoConfig.fps;

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

// --- Semantic Motion Types ---

export type SemanticPresetName = 'emphasis' | 'sequential' | 'flow';

export interface SemanticPreset {
  spring: SpringPreset;
  durationMs: [number, number];
  staggerMs: number | null;
  /** staggerMs を FPS で変換したフレーム数 (staggerMs が null の場合は 0) */
  staggerFrames: number;
}

// --- Spring resolver ---

const springPresets = anim.spring as Record<string, SpringPreset>;

export function resolveSpring(ref: string | SpringPreset | undefined): SpringPreset {
  if (!ref) return springPresets.default;
  if (typeof ref === 'string') return springPresets[ref] ?? springPresets.default;
  return ref;
}

// --- Semantic preset resolver ---

const rawSemanticPresets = anim.semanticPresets as Record<
  string,
  { spring: SpringPreset; durationMs: [number, number]; staggerMs: number | null }
>;

export function getSemanticPreset(name: SemanticPresetName): SemanticPreset {
  const raw = rawSemanticPresets?.[name];
  if (!raw) {
    return {
      spring: springPresets.default,
      durationMs: [400, 600],
      staggerMs: null,
      staggerFrames: 0,
    };
  }
  return {
    ...raw,
    staggerFrames: raw.staggerMs !== null ? Math.round((raw.staggerMs * FPS) / 1000) : 0,
  };
}

const rawComponentPresets = anim.componentPresets as Record<string, string[]> | undefined;

export function getComponentPresets(componentName: string): SemanticPresetName[] {
  return ((rawComponentPresets?.[componentName] ?? []) as SemanticPresetName[]);
}

/** 스태거 프리셋을 프레임 수로 반환. sequential=4f, flow=3f 기준 */
export function getStaggerFrames(name: SemanticPresetName): number {
  return getSemanticPreset(name).staggerFrames;
}

// --- Config resolver ---

export function getAnimConfig<T>(
  componentName: string,
  overrides?: AnimationOverrides,
): T {
  const defaults = (anim as Record<string, unknown>)[componentName] as T | undefined;
  if (!defaults) return {} as T;
  if (!overrides) return { ...defaults };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- shallow-merge requires indexing by dynamic keys
  const merged = { ...defaults } as Record<string, any>;
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

export interface StatScreenAnim {
  ring: ElementAnim;
  value: ElementAnim;
  label: ElementAnim;
  description: ElementAnim;
}

export interface TimelineScreenAnim {
  title: ElementAnim;
  line: Record<string, never>;
  event: ElementAnim;
}

export interface FeatureGridScreenAnim {
  title: ElementAnim;
  card: ElementAnim;
}

export interface AgendaScreenAnim {
  title: ElementAnim;
  item: ElementAnim;
  bar: Record<string, never>;
}

export interface BeforeAfterScreenAnim {
  title: ElementAnim;
  before: ElementAnim;
  arrow: ElementAnim;
  after: ElementAnim;
}

export interface BarChartScreenAnim {
  title: ElementAnim;
  bar: ElementAnim;
}

export interface PieChartScreenAnim {
  title: ElementAnim;
  chart: ElementAnim;
  legend: ElementAnim;
}

export interface BulletDetailScreenAnim {
  title: ElementAnim;
  item: ElementAnim;
}

export interface NumberedListScreenAnim {
  title: ElementAnim;
  item: ElementAnim;
}

export interface IconListScreenAnim {
  title: ElementAnim;
  item: ElementAnim;
}

export interface TwoColumnScreenAnim {
  title: ElementAnim;
  left: ElementAnim;
  right: ElementAnim;
}

export interface VennDiagramScreenAnim {
  title: ElementAnim;
  circle: ElementAnim;
  intersection: ElementAnim;
}

export interface HierarchyScreenAnim {
  title: ElementAnim;
  node: ElementAnim;
}

export interface CalloutScreenAnim {
  card: ElementAnim;
  text: ElementAnim;
}
