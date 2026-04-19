import { z } from 'zod';

// ─── Phase 3 optional props (공통 확장 props) ────────────────────────────────
// Phase 3a에서 정의된 optional props 집합.
// 컴포넌트별 허용 범위는 설계서 §5 Phase 3a props-to-component 매핑표 참조.

const commonOptional = {
  eyebrow: z.string().optional(),
  badge: z.string().optional(),
  metric: z.string().optional(),
  caption: z.string().optional(),
  backdropVariant: z.string().optional(),
  footnote: z.string().optional(),
  subtitle: z.string().optional(),
};

// ─── 기본/전환 ────────────────────────────────────────────────────────────────

export const TitleScreenSchema = z.object({
  title: z.string().optional(),
  main: z.string().optional(),
  sub: z.string().optional(),
  illustration: z.string().optional(),
  backdropVariant: z.string().optional(),
}).passthrough();

export const SectionBreakScreenSchema = z.object({
  section: z.string(),
  title: z.string(),
  subtitle: z.string().optional(),
}).passthrough();

export const EndScreenSchema = z.object({
  title: z.string().optional(),
  message: z.string().optional(),
  nextPreview: z.string().optional(),
  credits: z.array(z.string()).optional(),
}).passthrough();

// ─── 텍스트/설명 ──────────────────────────────────────────────────────────────

export const KeyPointScreenSchema = z.object({
  icon: z.string().optional(),
  headline: z.string(),
  detail: z.string().optional(),
  color: z.string().optional(),
  illustration: z.string().optional(),
  ...commonOptional,
}).passthrough();

export const QuoteScreenSchema = z.object({
  quote: z.string(),
  attribution: z.string().optional(),
}).passthrough();

export const DefinitionScreenSchema = z.object({
  term: z.string(),
  reading: z.string().optional(),
  definition: z.string(),
  example: z.string().optional(),
}).passthrough();

export const QnAScreenSchema = z.object({
  question: z.string(),
  answer: z.string(),
}).passthrough();

export const BulletDetailScreenSchema = z.object({
  title: z.string().optional(),
  items: z.array(z.object({
    title: z.string(),
    detail: z.string(),
    icon: z.string().optional(),
    color: z.string().optional(),
  })).min(1),
  ...commonOptional,
}).passthrough();

export const TwoColumnScreenSchema = z.object({
  title: z.string().optional(),
  left: z.object({
    title: z.string(),
    body: z.string(),
    icon: z.string().optional(),
    color: z.string().optional(),
  }),
  right: z.object({
    title: z.string(),
    body: z.string(),
    icon: z.string().optional(),
    color: z.string().optional(),
  }),
  ...commonOptional,
}).passthrough();

// ─── 리스트 ──────────────────────────────────────────────────────────────────

export const SummaryScreenSchema = z.object({
  title: z.string().optional(),
  points: z.array(z.string()).min(1),
  illustration: z.string().optional(),
  ...commonOptional,
}).passthrough();

export const NumberedListScreenSchema = z.object({
  title: z.string().optional(),
  items: z.array(z.object({
    title: z.string(),
    description: z.string().optional(),
  })).min(1),
}).passthrough();

export const IconListScreenSchema = z.object({
  title: z.string().optional(),
  items: z.array(z.object({
    icon: z.string(),
    title: z.string(),
    description: z.string().optional(),
    color: z.string().optional(),
    badge: z.string().optional(),
    metric: z.string().optional(),
    emphasis: z.boolean().optional(),
  })).min(1),
  ...commonOptional,
}).passthrough();

export const AgendaScreenSchema = z.object({
  title: z.string(),
  items: z.array(z.object({
    title: z.string(),
    description: z.string().optional(),
    icon: z.string().optional(),
    duration: z.string().optional(),
  })).min(1),
  activeIndex: z.number().int().optional(),
}).passthrough();

export const ProgressScreenSchema = z.object({
  title: z.string().optional(),
  steps: z.array(z.string()).min(1),
  currentStep: z.number().int().min(1),
}).passthrough();

// ─── 비교/관계 ────────────────────────────────────────────────────────────────

export const ComparisonScreenSchema = z.object({
  left: z.object({
    title: z.string(),
    points: z.array(z.string()).min(1),
    color: z.string().optional(),
  }),
  right: z.object({
    title: z.string(),
    points: z.array(z.string()).min(1),
    color: z.string().optional(),
  }),
  vsLabel: z.string().optional(),
  ...commonOptional,
}).passthrough();

export const BeforeAfterScreenSchema = z.object({
  title: z.string().optional(),
  before: z.object({
    label: z.string().optional(),
    points: z.array(z.string()).min(1),
    color: z.string().optional(),
  }),
  after: z.object({
    label: z.string().optional(),
    points: z.array(z.string()).min(1),
    color: z.string().optional(),
  }),
  ...commonOptional,
}).passthrough();

export const VennDiagramScreenSchema = z.object({
  title: z.string().optional(),
  left: z.object({
    label: z.string(),
    color: z.string().optional(),
  }),
  right: z.object({
    label: z.string(),
    color: z.string().optional(),
  }),
  intersection: z.string(),
  ...commonOptional,
}).passthrough();

// ─── 데이터 시각화 ────────────────────────────────────────────────────────────

export const StatScreenSchema = z.object({
  value: z.string(),
  label: z.string(),
  prefix: z.string().optional(),
  suffix: z.string().optional(),
  description: z.string().optional(),
  color: z.string().optional(),
  ...commonOptional,
}).passthrough();

export const BarChartScreenSchema = z.object({
  title: z.string().optional(),
  bars: z.array(z.object({
    label: z.string(),
    value: z.number(),
    color: z.string().optional(),
  })).min(1),
  unit: z.string().optional(),
  ...commonOptional,
}).passthrough();

export const PieChartScreenSchema = z.object({
  title: z.string().optional(),
  slices: z.array(z.object({
    label: z.string(),
    value: z.number(),
    color: z.string().optional(),
  })).min(1),
  ...commonOptional,
}).passthrough();

// ─── 구조/도식 ────────────────────────────────────────────────────────────────

export const DiagramScreenSchema = z.object({
  title: z.string().optional(),
  nodes: z.array(z.object({
    id: z.string(),
    label: z.string(),
    x: z.number(),
    y: z.number(),
    icon: z.string().optional(),
    color: z.string().optional(),
  })).min(1),
  edges: z.array(z.object({
    from: z.string(),
    to: z.string(),
    label: z.string().optional(),
  })).optional(),
  ...commonOptional,
}).passthrough();

export const TimelineScreenSchema = z.object({
  title: z.string().optional(),
  events: z.array(z.object({
    label: z.string(),
    description: z.string().optional(),
    icon: z.string().optional(),
    color: z.string().optional(),
  })).min(1),
  ...commonOptional,
}).passthrough();

export const FeatureGridScreenSchema = z.object({
  title: z.string().optional(),
  features: z.array(z.object({
    icon: z.string(),
    title: z.string(),
    description: z.string().optional(),
    color: z.string().optional(),
  })).min(1),
  columns: z.union([z.literal(2), z.literal(3)]).optional(),
  ...commonOptional,
}).passthrough();

const HierarchyNodeSchema: z.ZodType<any> = z.lazy(() =>
  z.object({
    label: z.string(),
    icon: z.string().optional(),
    children: z.array(HierarchyNodeSchema).optional(),
  })
);

export const HierarchyScreenSchema = z.object({
  title: z.string().optional(),
  root: HierarchyNodeSchema,
  ...commonOptional,
}).passthrough();

// ─── 강조 ────────────────────────────────────────────────────────────────────

export const CalloutScreenSchema = z.object({
  type: z.enum(['tip', 'warning', 'info', 'error']).optional(),
  title: z.string(),
  body: z.string(),
  icon: z.string().optional(),
  illustration: z.string().optional(),
  ...commonOptional,
}).passthrough();

export const ImagePlaceholderScreenSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  icon: z.string().optional(),
  label: z.string().optional(),
  layout: z.enum(['left', 'right']).optional(),
}).passthrough();

// ─── 브라우저 UI ──────────────────────────────────────────────────────────────

export const BrowserMockScreenSchema = z.object({
  url: z.string(),
  title: z.string().optional(),
  description: z.string().optional(),
  layout: z.enum(['left', 'right', 'full']).optional(),
  color: z.string().optional(),
}).passthrough();

export const ImageScreenSchema = z.object({
  src: z.string(),
  url: z.string().optional(),
  title: z.string().optional(),
  description: z.string().optional(),
  layout: z.enum(['left', 'right', 'full']).optional(),
  color: z.string().optional(),
}).passthrough();

// ─── 코드 ────────────────────────────────────────────────────────────────────

export const MyCodeSceneSchema = z.object({
  code: z.string(),
  language: z.string(),
  title: z.string().optional(),
}).passthrough();

export const CodeWalkthroughScreenSchema = z.object({
  title: z.string().optional(),
  code: z.string(),
  highlightLines: z.array(z.number().int()).optional(),
  caption: z.string().optional(),
}).passthrough();

// ─── Schema Registry ─────────────────────────────────────────────────────────

export const REMOTION_PROPS_SCHEMAS: Record<string, z.ZodTypeAny> = {
  TitleScreen: TitleScreenSchema,
  SectionBreakScreen: SectionBreakScreenSchema,
  EndScreen: EndScreenSchema,
  KeyPointScreen: KeyPointScreenSchema,
  QuoteScreen: QuoteScreenSchema,
  DefinitionScreen: DefinitionScreenSchema,
  QnAScreen: QnAScreenSchema,
  BulletDetailScreen: BulletDetailScreenSchema,
  TwoColumnScreen: TwoColumnScreenSchema,
  SummaryScreen: SummaryScreenSchema,
  NumberedListScreen: NumberedListScreenSchema,
  IconListScreen: IconListScreenSchema,
  AgendaScreen: AgendaScreenSchema,
  ProgressScreen: ProgressScreenSchema,
  ComparisonScreen: ComparisonScreenSchema,
  BeforeAfterScreen: BeforeAfterScreenSchema,
  VennDiagramScreen: VennDiagramScreenSchema,
  StatScreen: StatScreenSchema,
  BarChartScreen: BarChartScreenSchema,
  PieChartScreen: PieChartScreenSchema,
  DiagramScreen: DiagramScreenSchema,
  TimelineScreen: TimelineScreenSchema,
  FeatureGridScreen: FeatureGridScreenSchema,
  HierarchyScreen: HierarchyScreenSchema,
  CalloutScreen: CalloutScreenSchema,
  ImagePlaceholderScreen: ImagePlaceholderScreenSchema,
  BrowserMockScreen: BrowserMockScreenSchema,
  ImageScreen: ImageScreenSchema,
  MyCodeScene: MyCodeSceneSchema,
  CodeWalkthroughScreen: CodeWalkthroughScreenSchema,
};
