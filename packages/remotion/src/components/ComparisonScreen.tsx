import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';
import { theme } from '../theme';
import { getAnimConfig, resolveSpring, type ComparisonScreenAnim } from '../animation';

interface Side {
  title: string;
  points: string[];
  color?: string;
}

interface ComparisonScreenProps {
  left: Side;
  right: Side;
  vsLabel?: string;
  animation?: Partial<Record<keyof ComparisonScreenAnim, Record<string, unknown>>>;
}

export const ComparisonScreen: React.FC<ComparisonScreenProps> = ({
  left,
  right,
  vsLabel = 'VS',
  animation,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const a = getAnimConfig<ComparisonScreenAnim>('ComparisonScreen', animation);

  // Left panel slides in from left
  const leftSpring = spring({
    frame,
    fps,
    config: resolveSpring(a.left.spring),
  });
  const leftX = interpolate(leftSpring, [0, 1], [a.left.distance?.x ?? -120, 0]);
  const leftOpacity = interpolate(leftSpring, [0, 1], [0, 1]);

  // Right panel slides in from right
  const rightSpring = spring({
    frame: Math.max(0, frame - (a.right.delay ?? 8)),
    fps,
    config: resolveSpring(a.right.spring),
  });
  const rightX = interpolate(rightSpring, [0, 1], [a.right.distance?.x ?? 120, 0]);
  const rightOpacity = interpolate(rightSpring, [0, 1], [0, 1]);

  // VS label pops in
  const vsSpring = spring({
    frame: Math.max(0, frame - (a.vs.delay ?? 15)),
    fps,
    config: resolveSpring(a.vs.spring),
  });
  const vsScaleRange = a.vs.scale ?? [0, 1];
  const vsScale = interpolate(vsSpring, [0, 1], vsScaleRange);

  // Point stagger config
  const pointBaseDelay = a.point.baseDelay as number[] ?? [20, 28];
  const pointInterval = a.point.staggerInterval ?? 15;

  const renderSide = (side: Side, index: number) => {
    const isLeft = index === 0;
    const sideColor = side.color || (isLeft ? theme.color.accent : theme.color.accentSecondary);

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
            const baseDelay = isLeft ? pointBaseDelay[0] : pointBaseDelay[1];
            const pointDelay = baseDelay + i * pointInterval;
            const pointSpring = spring({
              frame: Math.max(0, frame - pointDelay),
              fps,
              config: resolveSpring(a.point.spring),
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
                    color: theme.color.textPrimary,
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
        background: theme.bg.primary,
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
              background: theme.color.divider,
            }}
          />
          <div
            style={{
              width: 80,
              height: 80,
              borderRadius: '50%',
              background: theme.color.surface,
              border: `2px solid ${theme.color.surfaceBorder}`,
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              fontSize: 28,
              fontWeight: 800,
              color: theme.color.textPrimary,
              transform: `scale(${vsScale})`,
            }}
          >
            {vsLabel}
          </div>
          <div
            style={{
              width: 2,
              height: 200,
              background: theme.color.divider,
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
