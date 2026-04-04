import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';
import { theme } from '../theme';
import { NodeIcon } from './NodeIcon';

interface KeyPointScreenProps {
  icon?: string;
  headline: string;
  detail?: string;
  color?: string;
}

export const KeyPointScreen: React.FC<KeyPointScreenProps> = ({
  icon,
  headline,
  detail,
  color,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const accentColor = color || theme.color.accent;

  // Icon/emoji scale-in with bounce
  const iconSpring = spring({
    frame,
    fps,
    config: { damping: 10, stiffness: 100, mass: 0.6 },
  });
  const iconScale = interpolate(iconSpring, [0, 1], [0, 1]);
  const iconOpacity = interpolate(iconSpring, [0, 1], [0, 1]);

  // Headline slides up after icon
  const headlineSpring = spring({
    frame: Math.max(0, frame - 12),
    fps,
    config: { damping: 14, stiffness: 80, mass: 0.8 },
  });
  const headlineY = interpolate(headlineSpring, [0, 1], [50, 0]);
  const headlineOpacity = interpolate(headlineSpring, [0, 1], [0, 1]);

  // Detail fades in after headline
  const detailSpring = spring({
    frame: Math.max(0, frame - 28),
    fps,
    config: { damping: 16, stiffness: 60, mass: 0.6 },
  });
  const detailOpacity = interpolate(detailSpring, [0, 1], [0, 1]);
  const detailY = interpolate(detailSpring, [0, 1], [25, 0]);

  // Accent line grows
  const lineWidth = interpolate(frame, [20, 50], [0, 120], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{
        background: theme.bg.primary,
        justifyContent: 'center',
        alignItems: 'center',
        textAlign: 'center',
      }}
    >
      {/* Background accent circle */}
      <div
        style={{
          position: 'absolute',
          width: 500,
          height: 500,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${accentColor}15 0%, transparent 70%)`,
          top: '50%',
          left: '50%',
          transform: `translate(-50%, -50%) scale(${iconScale})`,
        }}
      />

      <div style={{ position: 'relative', zIndex: 1, padding: '0 140px' }}>
        {/* Icon */}
        {icon && (
          <div
            style={{
              marginBottom: 30,
              opacity: iconOpacity,
              transform: `scale(${iconScale})`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <NodeIcon icon={icon} size={80} />
          </div>
        )}

        {/* Headline */}
        <h1
          style={{
            fontSize: 80,
            fontWeight: 800,
            color: theme.color.textPrimary,
            lineHeight: 1.3,
            marginBottom: 16,
            opacity: headlineOpacity,
            transform: `translateY(${headlineY}px)`,
          }}
        >
          {headline}
        </h1>

        {/* Accent line */}
        <div
          style={{
            width: lineWidth,
            height: 4,
            background: accentColor,
            margin: '0 auto 28px',
            borderRadius: 2,
          }}
        />

        {/* Detail text */}
        {detail && (
          <p
            style={{
              fontSize: 38,
              fontWeight: 400,
              color: theme.color.textSecondary,
              lineHeight: 1.6,
              opacity: detailOpacity,
              transform: `translateY(${detailY}px)`,
            }}
          >
            {detail}
          </p>
        )}
      </div>
    </AbsoluteFill>
  );
};
