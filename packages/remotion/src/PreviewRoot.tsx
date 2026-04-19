import { AbsoluteFill, Composition, registerRoot } from 'remotion';
import { SceneTransition } from './components';
import { waitForFonts } from './fonts/loadFonts';

waitForFonts();
import {
  DefaultScreen,
  type LectureData,
  PreviewComposition,
  type PreviewProps,
  type SceneData,
  SceneVisual,
} from './composition/shared';
import videoConfig from '../../../config/video.json';

interface PreviewSceneProps {
  lectureData: LectureData;
  sceneId: number;
  durationInFrames?: number;
  synthManifests?: Record<string, unknown>;
}

const DEFAULT_PREVIEW_DURATION = 600;

const findScene = (lectureData: LectureData, sceneId: number): SceneData | undefined =>
  lectureData.sequence.find(scene => scene.scene_id === sceneId);

const PreviewSceneComposition: React.FC<PreviewSceneProps> = ({
  lectureData,
  sceneId,
  durationInFrames = DEFAULT_PREVIEW_DURATION,
  synthManifests,
}) => {
  const scene = findScene(lectureData, sceneId);

  if (!scene) {
    return <DefaultScreen componentName={`Scene ${sceneId} Not Found`} />;
  }

  const transition = scene.visual.transition || {};
  const enter = transition.enter ?? 'fade';
  const exit = transition.exit ?? 'fade';

  return (
    <AbsoluteFill>
      <SceneTransition durationInFrames={durationInFrames} enter={enter} exit={exit}>
        <SceneVisual
          scene={scene}
          lectureId={lectureData.lecture_id}
          synthManifest={synthManifests?.[sceneId.toString()] as unknown}
        />
      </SceneTransition>
    </AbsoluteFill>
  );
};

export const PreviewRoot: React.FC = () => {
  const { width, height } = videoConfig.resolution;
  const fps = videoConfig.fps;

  return (
    <>
      <Composition
        id="PreviewScene"
        component={PreviewSceneComposition}
        width={width}
        height={height}
        fps={fps}
        durationInFrames={DEFAULT_PREVIEW_DURATION}
        defaultProps={{
          lectureData: { lecture_id: '', sequence: [] },
          sceneId: 1,
        } as PreviewSceneProps}
        calculateMetadata={async ({ props }) => {
          const { lectureData, sceneId, durationInFrames } = props as PreviewSceneProps;
          if (durationInFrames) {
            return { durationInFrames };
          }

          const scene = findScene(lectureData, sceneId);
          const derivedDuration = scene?.durationSec
            ? Math.max(Math.ceil(scene.durationSec * fps), fps * 4)
            : DEFAULT_PREVIEW_DURATION;

          return { durationInFrames: derivedDuration };
        }}
      />

      <Composition
        id="PreviewComponent"
        component={PreviewComposition}
        width={width}
        height={height}
        fps={fps}
        durationInFrames={90}
        defaultProps={{
          componentName: 'TitleScreen',
          props: { title: 'Preview', sub: 'サブタイトル' },
        } as PreviewProps}
      />
    </>
  );
};

registerRoot(PreviewRoot);
