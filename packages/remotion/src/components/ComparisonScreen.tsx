import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';

interface Side {
  title: string;
  points: string[];
  color?: string;
}

interface ComparisonScreenProps {
  left: Side;
  right: Side;
  vsLabel?: string;
}

export const ComparisonScreen: React.FC<ComparisonScreenProps> = ({
  left,
  right,
  vsLabel = 'VS',
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Left panel slides in from left
  const leftSpring = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 70, mass: 0.8 },
  });
  const leftX = interpolate(leftSpring, [0, 1], [-120, 0]);
  const leftOpacity = interpolate(leftSpring, [0, 1], [0, 1]);

  // Right panel slides in from right
  const rightSpring = spring({
    frame: Math.max(0, frame - 8),
    fps,
    config: { damping: 14, stiffness: 70, mass: 0.8 },
  });
  const rightX = interpolate(rightSpring, [0, 1], [120, 0]);
  const rightOpacity = interpolate(rightSpring, [0, 1], [0, 1]);

  // VS label pops in
  const vsSpring = spring({
    frame: Math.max(0, frame - 15),
    fps,
    config: { damping: 10, stiffness: 120, mass: 0.5 },
  });
  const vsScale = interpolate(vsSpring, [0, 1], [0, 1]);

  const renderSide = (side: Side, index: number) => {
    const isLeft = index === 0;
    const sideColor = side.color || (isLeft ? '#6366f1' : '#f59e0b');

    return (
      <div
        style={{
          flex: 1,
          padding: '60px 50px',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Side title */}
        <h2
          style={{
            fontSize: 52,
            fontWeight: 800,
            color: sideColor,
            marginBottom: 40,
            textAlign: 'center',
          }}
        >
          {side.title}
        </h2>

        {/* Divider line */}
        <div
          style={{
            width: 80,
            height: 3,
            background: sideColor,
            margin: '0 auto 36px',
            borderRadius: 2,
            opacity: 0.6,
          }}
        />

        {/* Points with stagger */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {side.points.map((point, i) => {
            const baseDelay = isLeft ? 20 : 28;
            const pointDelay = baseDelay + i * 15;
            const pointSpring = spring({
              frame: Math.max(0, frame - pointDelay),
              fps,
              config: { damping: 14, stiffness: 70, mass: 0.6 },
            });
            const pointOpacity = interpolate(pointSpring, [0, 1], [0, 1]);

            return (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 16,
                  opacity: pointOpacity,
                }}
              >
                <div
                  style={{
                    minWidth: 10,
                    height: 10,
                    borderRadius: '50%',
                    background: sideColor,
                    marginTop: 16,
                    opacity: 0.7,
                  }}
                />
                <span
                  style={{
                    fontSize: 34,
                    color: '#e2e8f0',
                    lineHeight: 1.5,
                  }}
                >
                  {point}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <AbsoluteFill
      style={{
        background: 'linear-gradient(160deg, #0f0c29 0%, #1a1a2e 50%, #16213e 100%)',
      }}
    >
      <div
        style={{
          display: 'flex',
          width: '100%',
          height: '100%',
          alignItems: 'center',
          position: 'relative',
        }}
      >
        {/* Left side */}
        <div
          style={{
            flex: 1,
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            opacity: leftOpacity,
            transform: `translateX(${leftX}px)`,
          }}
        >
          {renderSide(left, 0)}
        </div>

        {/* VS divider */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 20,
            zIndex: 2,
          }}
        >
          <div
            style={{
              width: 2,
              height: 200,
              background: 'rgba(255,255,255,0.1)',
            }}
          />
          <div
            style={{
              width: 80,
              height: 80,
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.1)',
              border: '2px solid rgba(255,255,255,0.2)',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              fontSize: 28,
              fontWeight: 800,
              color: '#ffffff',
              transform: `scale(${vsScale})`,
            }}
          >
            {vsLabel}
          </div>
          <div
            style={{
              width: 2,
              height: 200,
              background: 'rgba(255,255,255,0.1)',
            }}
          />
        </div>

        {/* Right side */}
        <div
          style={{
            flex: 1,
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            opacity: rightOpacity,
            transform: `translateX(${rightX}px)`,
          }}
        >
          {renderSide(right, 1)}
        </div>
      </div>
    </AbsoluteFill>
  );
};
