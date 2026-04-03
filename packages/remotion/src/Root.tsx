import { Composition, Sequence, Audio, Video, AbsoluteFill } from 'remotion';
import { MyCodeScene } from './MyCodeScene';
<<<<<<< Updated upstream
import lectureData from '../../data/p1-01-01.json'; // JSON 데이터를 직접 임포트
=======
import videoConfig from '../../../config/video.json';
>>>>>>> Stashed changes

// 나중에 구현할 컴포넌트들을 위한 플레이스홀더
const TitleScreen: React.FC<{ main: string; sub: string }> = ({ main, sub }) => (
  <AbsoluteFill style={{ backgroundColor: '#1a1a1a', color: 'white', justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
    <h1 style={{ fontSize: '100px', marginBottom: '20px' }}>{main}</h1>
    <h2 style={{ fontSize: '50px', opacity: 0.8 }}>{sub}</h2>
  </AbsoluteFill>
);

const SummaryScreen: React.FC<{ points: string[] }> = ({ points }) => (
  <AbsoluteFill style={{ backgroundColor: '#2d3436', color: 'white', padding: '100px' }}>
    <h1 style={{ fontSize: '80px', marginBottom: '60px' }}>오늘의 핵심 요약</h1>
    <ul style={{ fontSize: '40px', lineHeight: '2' }}>
      {points.map((p, i) => <li key={i}>{p}</li>)}
    </ul>
  </AbsoluteFill>
);

<<<<<<< Updated upstream
export const RemotionRoot: React.FC = () => {
  // 각 씬의 지속 시간을 계산 (현재는 임시로 10초씩 할당, 실제로는 오디오 길이에 맞춰야 함)
  const FPS = 30;
  const SCENE_DURATION = 10 * FPS; 
=======
// 타입 정의
interface SceneData {
  scene_id: number;
  visual: {
    type: string;
    component?: string;
    props?: Record<string, unknown>;
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

// 메인 강의 컴포넌트
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

        return (
          <Sequence
            key={scene.scene_id}
            from={sceneStart}
            durationInFrames={sceneDuration}
          >
            <AbsoluteFill>
              {scene.visual.type === 'playwright' ? (
                <Video src={captureUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : scene.visual.component === 'TitleScreen' ? (
                <TitleScreen {...scene.visual.props as any} />
              ) : scene.visual.component === 'SummaryScreen' ? (
                <SummaryScreen {...scene.visual.props as any} />
              ) : (
                <MyCodeScene />
              )}
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
>>>>>>> Stashed changes

  return (
    <>
      <Composition
        id="FullLecture"
<<<<<<< Updated upstream
        component={() => (
          <AbsoluteFill>
            {lectureData.sequence.map((scene, index) => {
              const audioUrl = `/audio/${lectureData.lecture_id}/scene-${scene.scene_id}.wav`;
              const captureUrl = `/captures/${lectureData.lecture_id}/scene-${scene.scene_id}.webm`;

              return (
                <Sequence
                  key={scene.scene_id}
                  from={index * SCENE_DURATION}
                  durationInFrames={SCENE_DURATION}
                >
                  <AbsoluteFill>
                    {/* 1. 시각 자료 렌더링 */}
                    {scene.visual.type === 'playwright' ? (
                      <Video src={captureUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : scene.visual.component === 'TitleScreen' ? (
                      <TitleScreen {...scene.visual.props} />
                    ) : scene.visual.component === 'SummaryScreen' ? (
                      <SummaryScreen {...scene.visual.props} />
                    ) : (
                      <MyCodeScene /> // 기본값
                    )}

                    {/* 2. 나레이션 오디오 */}
                    <Audio src={audioUrl} />
                  </AbsoluteFill>
                </Sequence>
              );
            })}
          </AbsoluteFill>
        )}
        durationInFrames={lectureData.sequence.length * SCENE_DURATION}
        fps={FPS}
        width={1920}
        height={1080}
=======
        component={FullLectureComposition}
        width={width}
        height={height}
        fps={FPS}
        durationInFrames={300} // calculateMetadata에서 동적으로 계산됨
        defaultProps={{
          lectureData: { lecture_id: '', sequence: [] },
          audioDurations: {},
        }}
        calculateMetadata={async ({ props }) => {
          const { lectureData, audioDurations } = props as LectureProps;

          // props가 없으면 기본값 반환
          if (!lectureData?.sequence?.length) {
            return { durationInFrames: 300 };
          }

          // 전체 영상 길이 계산
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
>>>>>>> Stashed changes
      />
    </>
  );
};
