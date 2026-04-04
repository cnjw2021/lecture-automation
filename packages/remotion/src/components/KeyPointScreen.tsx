import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';
import { theme } from '../theme';
import { NodeIcon } from './NodeIcon';
import { getAnimConfig, resolveSpring, type KeyPointScreenAnim } from '../animation';

interface KeyPointScreenProps {
  icon?: string;
  headline: string;
  detail?: string;
  color?: string;
  animation?: Partial<Record<keyof KeyPointScreenAnim, Record<string, unknown>>>;
}

export const KeyPointScreen: React.FC<KeyPointScreenProps> = ({
  icon,
  headline,
  detail,
  color,
  animation,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const a = getAnimConfig<KeyPointScreenAnim>('KeyPointScreen', animation);

  const accentColor = color || theme.color.accent;

  // Icon/emoji scale-in with bounce
  const iconSpring = spring({
    frame,
    fps,
    config: resolveSpring(a.icon.spring),
  });
  const iconScaleRange = a.icon.scale ?? [0, 1];
  const iconScale = interpolate(iconSpring, [0, 1], iconScaleRange);
  const iconOpacity = interpolate(iconSpring, [0, 1], [0, 1]);

  // Headline slides up after icon
  const headlineSpring = spring({
    frame: Math.max(0, frame - (a.headline.delay ?? 12)),
    fps,
    config: resolveSpring(a.headline.spring),
  });
  const headlineY = interpolate(headlineSpring, [0, 1], [a.headline.distance?.y ?? 50, 0]);
  const headlineOpacity = interpolate(headlineSpring, [0, 1], [0, 1]);

  // Detail fades in after headline
  const detailSpring = spring({
    frame: Math.max(0, frame - (a.detail.delay ?? 28)),
    fps,
    config: resolveSpring(a.detail.spring),
  });
  const detailOpacity = interpolate(detailSpring, [0, 1], [0, 1]);
  const detailY = interpolate(detailSpring, [0, 1], [a.detail.distance?.y ?? 25, 0]);

  // Accent line grows
  const lineWidth = interpolate(frame, a.line.frames, [0, a.line.width], {
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
