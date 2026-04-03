import { Composition, Sequence, Audio, Video, AbsoluteFill, registerRoot, staticFile } from 'remotion';
import { MyCodeScene } from './MyCodeScene';
import {
  TitleScreen,
  SummaryScreen,
  SceneTransition,
  KeyPointScreen,
  ComparisonScreen,
  DiagramScreen,
  ProgressScreen,
  QuoteScreen,
} from './components';
import videoConfig from '../../../config/video.json';

// Fallback for unknown components
const DefaultScreen: React.FC<{ componentName?: string }> = ({ componentName }) => (
  <AbsoluteFill style={{ backgroundColor: '#000', color: '#555', justifyContent: 'center', alignItems: 'center' }}>
    <p style={{ fontSize: '30px' }}>[Missing Component: {componentName || 'Unknown'}]</p>
  </AbsoluteFill>
);

// Component registry - add new components here
const COMPONENT_MAP: Record<string, React.FC<any>> = {
  TitleScreen,
  SummaryScreen,
  MyCodeScene,
  KeyPointScreen,
  ComparisonScreen,
  DiagramScreen,
  ProgressScreen,
  QuoteScreen,
};

// Type definitions
interface TransitionConfig {
  enter?: 'fade' | 'slide-left' | 'slide-up' | 'zoom' | 'none';
  exit?: 'fade' | 'slide-right' | 'slide-down' | 'zoom' | 'none';
  durationFrames?: number;
}

interface SceneData {
  scene_id: number;
  visual: {
    type: string;
    component?: string;
    props?: Record<string, unknown>;
    transition?: TransitionConfig;
  };
}

interface LectureData {
  lecture_id: string;
  sequence: SceneData[];
}

interface LectureProps {
  lectureData: LectureData;
  audioDurations: Record<string, number>;
}

// Main lecture composition
const FullLectureComposition: React.FC<LectureProps> = ({ lectureData, audioDurations }) => {
  const FPS = videoConfig.fps;

  const getSceneDurationFrames = (sceneId: number): number => {
    const durationSec = audioDurations[sceneId.toString()] || 10;
    return Math.ceil((durationSec + 0.5) * FPS);
  };

  const getSceneStartFrame = (index: number): number => {
    let startFrame = 0;
    for (let i = 0; i < index; i++) {
      startFrame += getSceneDurationFrames(lectureData.sequence[i].scene_id);
    }
    return startFrame;
  };

  return (
    <AbsoluteFill>
      {lectureData.sequence.map((scene, index) => {
        const audioUrl = staticFile(`audio/${lectureData.lecture_id}/scene-${scene.scene_id}.wav`);
        const captureUrl = staticFile(`captures/${lectureData.lecture_id}/scene-${scene.scene_id}.webm`);
        const sceneDuration = getSceneDurationFrames(scene.scene_id);
        const sceneStart = getSceneStartFrame(index);

        // Resolve transition config (defaults to fade)
        const transition = scene.visual.transition || {};
        const enter = transition.enter ?? 'fade';
        const exit = transition.exit ?? 'fade';

        // Resolve component
        const Component = scene.visual.component
          ? COMPONENT_MAP[scene.visual.component] || DefaultScreen
          : null;

        const visualContent = scene.visual.type === 'playwright' ? (
          <Video src={captureUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : Component ? (
          <Component {...(scene.visual.props || {})} componentName={scene.visual.component} />
        ) : (
          <DefaultScreen componentName={scene.visual.component} />
        );

        return (
          <Sequence
            key={scene.scene_id}
            from={sceneStart}
            durationInFrames={sceneDuration}
          >
            <AbsoluteFill>
              <SceneTransition
                durationInFrames={sceneDuration}
                enter={enter}
                exit={exit}
              >
                {visualContent}
              </SceneTransition>
              <Audio src={audioUrl} />
            </AbsoluteFill>
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};

export const RemotionRoot: React.FC = () => {
  const { width, height } = videoConfig.resolution;
  const FPS = videoConfig.fps;

  return (
    <>
      <Composition
        id="FullLecture"
        component={FullLectureComposition}
        width={width}
        height={height}
        fps={FPS}
        durationInFrames={300}
        defaultProps={{
          lectureData: { lecture_id: '', sequence: [] },
          audioDurations: {},
        } as LectureProps}
        calculateMetadata={async ({ props }) => {
          const { lectureData, audioDurations } = props as LectureProps;

          if (!lectureData?.sequence?.length) {
            return { durationInFrames: 300 };
          }

          const getSceneDurationFrames = (sceneId: number): number => {
            const durationSec = audioDurations[sceneId.toString()] || 10;
            return Math.ceil((durationSec + 0.5) * FPS);
          };

          const totalDurationFrames = lectureData.sequence.reduce(
            (acc, scene) => acc + getSceneDurationFrames(scene.scene_id),
            0
          );

          return {
            durationInFrames: totalDurationFrames,
          };
        }}
      />
    </>
  );
};

registerRoot(RemotionRoot);
