import { Composition, Sequence, Audio, Video, AbsoluteFill, registerRoot, staticFile } from 'remotion';
import { MyCodeScene } from './MyCodeScene';
import lectureData from '../../../data/p1-01-01.json';
import audioDurations from '../public/audio/P1-01-01-FULL/durations.json';
import videoConfig from '../../../config/video.json'; 

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

export const RemotionRoot: React.FC = () => {
  const { width, height } = videoConfig.resolution;
  const FPS = videoConfig.fps;

  // 각 scene의 duration을 프레임으로 계산 (오디오 길이 + 0.5초 여유)
  const getSceneDurationFrames = (sceneId: number): number => {
    const durationSec = audioDurations[sceneId as keyof typeof audioDurations] || 10;
    return Math.ceil((durationSec + 0.5) * FPS);
  };

  // 각 scene의 시작 프레임 계산 (이전 scene들의 duration 누적)
  const getSceneStartFrame = (index: number): number => {
    let startFrame = 0;
    for (let i = 0; i < index; i++) {
      startFrame += getSceneDurationFrames(lectureData.sequence[i].scene_id);
    }
    return startFrame;
  };

  // 전체 영상 길이 계산
  const totalDurationFrames = lectureData.sequence.reduce(
    (acc, scene) => acc + getSceneDurationFrames(scene.scene_id),
    0
  );

  return (
    <>
      <Composition
        id="FullLecture"
        component={() => (
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
        )}
        durationInFrames={totalDurationFrames}
        fps={FPS}
        width={width}
        height={height}
      />
    </>
  );
};

registerRoot(RemotionRoot);
