import { AbsoluteFill, OffthreadVideo, staticFile } from 'remotion';
import { MyCodeScene } from '../MyCodeScene';
import {
  AgendaScreen,
  BarChartScreen,
  BeforeAfterScreen,
  BoxModelDiagramScreen,
  BrowserMockScreen,
  BulletDetailScreen,
  CalloutScreen,
  CodeRenderMappingScreen,
  CodeWalkthroughScreen,
  ComparisonScreen,
  DefinitionScreen,
  DiagramScreen,
  EndScreen,
  FeatureGridScreen,
  FlexLayoutDiagramScreen,
  HierarchyScreen,
  IconListScreen,
  ImagePlaceholderScreen,
  ImageScreen,
  KeyPointScreen,
  NumberedListScreen,
  PieChartScreen,
  PlaywrightSynthScene,
  ProgressScreen,
  QnAScreen,
  QuoteScreen,
  SectionBreakScreen,
  SelectorMatchScreen,
  StatScreen,
  StructureToRenderScreen,
  SummaryScreen,
  TimelineScreen,
  TitleScreen,
  TwoColumnScreen,
  VennDiagramScreen,
} from '../components';

// Fallback for unknown components
export const DefaultScreen: React.FC<{ componentName?: string }> = ({ componentName }) => (
  <AbsoluteFill style={{ backgroundColor: '#000', color: '#555', justifyContent: 'center', alignItems: 'center' }}>
    <p style={{ fontSize: '30px' }}>[Missing Component: {componentName || 'Unknown'}]</p>
  </AbsoluteFill>
);

// Component registry - add new components here
export const COMPONENT_MAP: Record<string, React.FC<any>> = {
  TitleScreen,
  SummaryScreen,
  MyCodeScene,
  KeyPointScreen,
  ComparisonScreen,
  DiagramScreen,
  ProgressScreen,
  QuoteScreen,
  StatScreen,
  TimelineScreen,
  FeatureGridScreen,
  AgendaScreen,
  CodeWalkthroughScreen,
  BeforeAfterScreen,
  BarChartScreen,
  PieChartScreen,
  BulletDetailScreen,
  DefinitionScreen,
  QnAScreen,
  SectionBreakScreen,
  EndScreen,
  TwoColumnScreen,
  ImagePlaceholderScreen,
  CalloutScreen,
  NumberedListScreen,
  IconListScreen,
  VennDiagramScreen,
  HierarchyScreen,
  BrowserMockScreen,
  ImageScreen,
  BoxModelDiagramScreen,
  CodeRenderMappingScreen,
  StructureToRenderScreen,
  FlexLayoutDiagramScreen,
  SelectorMatchScreen,
};

export interface TransitionConfig {
  enter?: 'fade' | 'slide-left' | 'slide-up' | 'zoom' | 'none';
  exit?: 'fade' | 'slide-right' | 'slide-down' | 'zoom' | 'none';
  durationFrames?: number;
}

export interface SceneData {
  scene_id: number;
  durationSec?: number;
  visual: {
    type: string;
    component?: string;
    props?: Record<string, unknown>;
    transition?: TransitionConfig;
    url?: string;
    title?: string;
    description?: string;
    layout?: string;
    animation?: Record<string, unknown>;
    stylePreset?: string;
  };
}

export interface LectureData {
  lecture_id: string;
  sequence: SceneData[];
}

export interface PreviewProps {
  componentName: string;
  props: Record<string, unknown>;
}

export interface SceneVisualProps {
  scene: SceneData;
  lectureId: string;
  synthManifest?: unknown;
}

export const calcSceneDurationFrames = (
  scene: SceneData,
  audioDurations: Record<string, number>,
  fps: number,
  scenePaddingSec: number
): number => {
  const audioDur = audioDurations[scene.scene_id.toString()] ?? 10;
  const declared = scene.durationSec ?? 0;
  // Playwright 씬 등 action 시간이 TTS 길이보다 긴 경우를 위해 max 취함.
  // 선언값이 없으면 오디오 길이만 사용 (하위 호환).
  const durationSec = Math.max(audioDur, declared);
  return Math.ceil((durationSec + scenePaddingSec) * fps);
};

export const SceneVisual: React.FC<SceneVisualProps> = ({ scene, lectureId, synthManifest }) => {
  const captureUrl = staticFile(`captures/${lectureId}/scene-${scene.scene_id}.webm`);
  const Component = scene.visual.component
    ? COMPONENT_MAP[scene.visual.component] || DefaultScreen
    : null;

  if (scene.visual.type === 'playwright') {
    if (synthManifest) {
      return <PlaywrightSynthScene manifest={synthManifest as any} lectureId={lectureId} />;
    }

    return <OffthreadVideo src={captureUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />;
  }

  if (scene.visual.type === 'screenshot') {
    return (
      <ImageScreen
        src={`screenshots/${lectureId}/scene-${scene.scene_id}.png`}
        url={scene.visual.url}
        title={scene.visual.title}
        description={scene.visual.description}
        layout={scene.visual.layout}
        animation={scene.visual.animation}
      />
    );
  }

  if (Component) {
    return <Component {...(scene.visual.props || {})} componentName={scene.visual.component} />;
  }

  return <DefaultScreen componentName={scene.visual.component} />;
};

export const PreviewComposition: React.FC<PreviewProps> = ({ componentName, props: componentProps }) => {
  const Component = COMPONENT_MAP[componentName] || DefaultScreen;
  return <Component {...componentProps} componentName={componentName} />;
};
