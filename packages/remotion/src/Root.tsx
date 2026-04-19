import { Composition, Sequence, Audio, AbsoluteFill, registerRoot } from 'remotion';
import { SceneTransition } from './components';
import {
  calcSceneDurationFrames,
  DefaultScreen,
  type LectureData,
  PreviewComposition,
  type PreviewProps,
  SceneVisual,
  type SceneData,
} from './composition/shared';
import videoConfig from '../../../config/video.json';

interface LectureProps {
  lectureData: LectureData;
  audioDurations: Record<string, number>;
  /** 상태 합성형 매니페스트 (sceneId → manifest). 존재하면 합성 모드 사용 */
  synthManifests?: Record<string, unknown>;
}

interface SingleSceneProps {
  lectureData: LectureData;
  audioDurations: Record<string, number>;
  sceneId: number;
  synthManifests?: Record<string, unknown>;
}

// --- Full lecture composition ---

const FullLectureComposition: React.FC<LectureProps> = ({ lectureData, audioDurations, synthManifests }) => {
  const FPS = videoConfig.fps;
  const scenePaddingSec = videoConfig.scenePaddingSec ?? 0.5;

  const getSceneStartFrame = (index: number): number => {
    let startFrame = 0;
    for (let i = 0; i < index; i++) {
      startFrame += calcSceneDurationFrames(lectureData.sequence[i].scene_id, audioDurations, FPS, scenePaddingSec);
    }
    return startFrame;
  };

  return (
    <AbsoluteFill>
      {lectureData.sequence.map((scene, index) => {
        const audioUrl = staticFile(`audio/${lectureData.lecture_id}/scene-${scene.scene_id}.wav`);
        const sceneDuration = calcSceneDurationFrames(scene.scene_id, audioDurations, FPS, scenePaddingSec);
        const sceneStart = getSceneStartFrame(index);

        const transition = scene.visual.transition || {};
        const enter = transition.enter ?? 'fade';
        const exit = transition.exit ?? 'fade';

        return (
          <Sequence key={scene.scene_id} from={sceneStart} durationInFrames={sceneDuration}>
            <AbsoluteFill>
              <SceneTransition durationInFrames={sceneDuration} enter={enter} exit={exit}>
                <SceneVisual
                  scene={scene}
                  lectureId={lectureData.lecture_id}
                  synthManifest={synthManifests?.[scene.scene_id.toString()] as unknown}
                />
              </SceneTransition>
              <Audio src={audioUrl} />
            </AbsoluteFill>
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};

// --- Single scene composition (씬 클립 캐시용) ---

const SingleSceneComposition: React.FC<SingleSceneProps> = ({ lectureData, audioDurations, sceneId, synthManifests }) => {
  const FPS = videoConfig.fps;
  const scenePaddingSec = videoConfig.scenePaddingSec ?? 0.5;

  const scene = lectureData.sequence.find(s => s.scene_id === sceneId);
  if (!scene) {
    return <DefaultScreen componentName={`Scene ${sceneId} Not Found`} />;
  }

  const durationInFrames = calcSceneDurationFrames(sceneId, audioDurations, FPS, scenePaddingSec);
  const audioUrl = staticFile(`audio/${lectureData.lecture_id}/scene-${sceneId}.wav`);

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
      <Audio src={audioUrl} />
    </AbsoluteFill>
  );
};

export const RemotionRoot: React.FC = () => {
  const { width, height } = videoConfig.resolution;
  const FPS = videoConfig.fps;
  const scenePaddingSec = videoConfig.scenePaddingSec ?? 0.5;

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
          if (!lectureData?.sequence?.length) return { durationInFrames: 300 };

          const totalDurationFrames = lectureData.sequence.reduce(
            (acc, scene) => acc + calcSceneDurationFrames(scene.scene_id, audioDurations, FPS, scenePaddingSec),
            0
          );
          return { durationInFrames: totalDurationFrames };
        }}
      />

      <Composition
        id="SingleScene"
        component={SingleSceneComposition}
        width={width}
        height={height}
        fps={FPS}
        durationInFrames={300}
        defaultProps={{
          lectureData: { lecture_id: '', sequence: [] },
          audioDurations: {},
          sceneId: 1,
        } as SingleSceneProps}
        calculateMetadata={async ({ props }) => {
          const { audioDurations, sceneId } = props as SingleSceneProps;
          if (!audioDurations || !sceneId) return { durationInFrames: 300 };

          return {
            durationInFrames: calcSceneDurationFrames(sceneId, audioDurations, FPS, scenePaddingSec),
          };
        }}
      />

      <Composition
        id="Preview"
        component={PreviewComposition}
        width={width}
        height={height}
        fps={FPS}
        durationInFrames={90}
        defaultProps={{
          componentName: 'TitleScreen',
          props: { title: 'Preview', sub: 'サブタイトル' },
        } as PreviewProps}
      />
    </>
  );
};

registerRoot(RemotionRoot);
