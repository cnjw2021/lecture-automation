import { AbsoluteFill, OffthreadVideo, staticFile } from 'remotion';
import { MyCodeScene } from '../MyCodeScene';
import {
  AgendaScreen,
  BarChartScreen,
  BeforeAfterScreen,
  BrowserMockScreen,
  BulletDetailScreen,
  CalloutScreen,
  CodeWalkthroughScreen,
  ComparisonScreen,
  DefinitionScreen,
  DiagramScreen,
  EndScreen,
  FeatureGridScreen,
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
  StatScreen,
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
  sceneId: number,
  audioDurations: Record<string, number>,
  fps: number,
  scenePaddingSec: number
): number => {
  const durationSec = audioDurations[sceneId.toString()] || 10;
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
