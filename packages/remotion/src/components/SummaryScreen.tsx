import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';
import { theme } from '../theme';

interface SummaryScreenProps {
  points: string[];
  title?: string;
}

export const SummaryScreen: React.FC<SummaryScreenProps> = ({ points, title }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const displayTitle = title || 'Summary';

  // Title slides in from left with spring
  const titleSpring = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 80, mass: 0.8 },
  });
  const titleX = interpolate(titleSpring, [0, 1], [-80, 0]);
  const titleOpacity = interpolate(titleSpring, [0, 1], [0, 1]);

  return (
    <AbsoluteFill
      style={{
        background: theme.bg.primary,
        color: theme.color.textPrimary,
        padding: '100px 120px',
      }}
    >
      {/* Title */}
      <h1
        style={{
          fontSize: 72,
          fontWeight: 800,
          marginBottom: 60,
          opacity: titleOpacity,
          transform: `translateX(${titleX}px)`,
          color: theme.color.textPrimary,
        }}
      >
        {displayTitle}
      </h1>

      {/* Bullet points with staggered animation */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
        {points.map((point, i) => {
          const staggerDelay = 15 + i * 20; // 20 frames apart
          const pointSpring = spring({
            frame: Math.max(0, frame - staggerDelay),
            fps,
            config: { damping: 14, stiffness: 70, mass: 0.7 },
          });
          const pointOpacity = interpolate(pointSpring, [0, 1], [0, 1]);
          const pointX = interpolate(pointSpring, [0, 1], [-50, 0]);
          const pointScale = interpolate(pointSpring, [0, 1], [0.95, 1]);

          // Checkmark appears slightly after text
          const checkDelay = staggerDelay + 8;
          const checkOpacity = interpolate(frame, [checkDelay, checkDelay + 10], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          });

          return (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 24,
                opacity: pointOpacity,
                transform: `translateX(${pointX}px) scale(${pointScale})`,
              }}
            >
              {/* Number badge */}
              <div
                style={{
                  minWidth: 52,
                  height: 52,
                  borderRadius: 14,
                  background: `rgba(196,123,90,${0.08 + checkOpacity * 0.15})`,
                  border: `2px solid ${theme.color.surfaceBorder}`,
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  fontSize: 26,
                  fontWeight: 700,
                  color: theme.color.accent,
                }}
              >
                {i + 1}
              </div>

              {/* Point text */}
              <span
                style={{
                  fontSize: 40,
                  lineHeight: 1.5,
                  fontWeight: 500,
                  color: theme.color.textPrimary,
                }}
              >
                {point}
              </span>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
