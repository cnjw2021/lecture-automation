import { Composition, Sequence, Audio, Video, AbsoluteFill } from 'remotion';
import { MyCodeScene } from './MyCodeScene';
import lectureData from '../../data/p1-01-01.json'; // JSON 데이터를 직접 임포트

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
  // 각 씬의 지속 시간을 계산 (현재는 임시로 10초씩 할당, 실제로는 오디오 길이에 맞춰야 함)
  const FPS = 30;
  const SCENE_DURATION = 10 * FPS; 

  return (
    <>
      <Composition
        id="FullLecture"
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
      />
    </>
  );
};
