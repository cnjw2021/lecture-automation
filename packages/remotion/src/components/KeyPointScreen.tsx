import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';
import { theme, typographyStyle } from '../theme';
import { NodeIcon } from './NodeIcon';
import { getAnimConfig, resolveSpring, type KeyPointScreenAnim } from '../animation';
import {
  SectionEyebrow,
  MetricBadge,
  DecorativeBackdrop,
  IllustrationPanel,
} from './shared';
import type { BackdropVariant } from './shared';

interface KeyPointScreenProps {
  icon?: string;
  headline: string;
  detail?: string;
  color?: string;
  eyebrow?: string;
  badge?: string;
  metric?: string;
  caption?: string;
  illustration?: string;
  backdropVariant?: BackdropVariant;
  animation?: Partial<Record<keyof KeyPointScreenAnim, Record<string, unknown>>>;
}

export const KeyPointScreen: React.FC<KeyPointScreenProps> = ({
  icon,
  headline,
  detail,
  color,
  eyebrow,
  badge,
  metric,
  caption,
  illustration,
  backdropVariant,
  animation,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const a = getAnimConfig<KeyPointScreenAnim>('KeyPointScreen', animation);

  const accentColor = color || theme.color.accent;

  const iconSpring = spring({ frame, fps, config: resolveSpring(a.icon.spring) });
  const iconScaleRange = a.icon.scale ?? [0, 1];
  const iconScale = interpolate(iconSpring, [0, 1], iconScaleRange);
  const iconOpacity = interpolate(iconSpring, [0, 1], [0, 1]);

  const headlineSpring = spring({
    frame: Math.max(0, frame - (a.headline.delay ?? 12)),
    fps,
    config: resolveSpring(a.headline.spring),
  });
  const headlineY = interpolate(headlineSpring, [0, 1], [a.headline.distance?.y ?? 50, 0]);
  const headlineOpacity = interpolate(headlineSpring, [0, 1], [0, 1]);

  const detailSpring = spring({
    frame: Math.max(0, frame - (a.detail.delay ?? 28)),
    fps,
    config: resolveSpring(a.detail.spring),
  });
  const detailOpacity = interpolate(detailSpring, [0, 1], [0, 1]);
  const detailY = interpolate(detailSpring, [0, 1], [a.detail.distance?.y ?? 25, 0]);

  const lineWidth = interpolate(frame, a.line.frames, [0, a.line.width], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const headlineSpec = typographyStyle('display');
  const detailSpec = typographyStyle('title');
  const captionSpec = typographyStyle('caption');

  return (
    <AbsoluteFill
      style={{
        background: theme.bg.primary,
        justifyContent: 'center',
        alignItems: 'center',
        textAlign: 'center',
        overflow: 'hidden',
      }}
    >
      {/* Backdrop */}
      {backdropVariant && (
        <DecorativeBackdrop variant={backdropVariant} color={accentColor} opacity={0.065} />
      )}

      {/* Spotlight glow */}
      <div
        style={{
          position: 'absolute',
          width: 600,
          height: 600,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${accentColor}14 0%, transparent 70%)`,
          top: '50%',
          left: '50%',
          transform: `translate(-50%, -50%) scale(${iconScale})`,
        }}
      />

      {/* Illustration behind */}
      {illustration && (
        <IllustrationPanel src={illustration} layout="behind" size={500} />
      )}

      <div style={{ position: 'relative', zIndex: 1, padding: '0 140px', maxWidth: 1400 }}>
        {/* Eyebrow */}
        {eyebrow && (
          <div
            style={{
              opacity: headlineOpacity,
              transform: `translateY(${headlineY}px)`,
              marginBottom: 16,
            }}
          >
            <SectionEyebrow text={eyebrow} color={accentColor} />
          </div>
        )}

        {/* Icon */}
        {icon && (
          <div
            style={{
              marginBottom: 28,
              opacity: iconOpacity,
              transform: `scale(${iconScale})`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <NodeIcon icon={icon} size={88} variant="lucide-accent" color={accentColor} />
          </div>
        )}

        {/* Headline */}
        <h1
          style={{
            ...headlineSpec,
            color: theme.color.textPrimary,
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
            margin: '0 auto 24px',
            borderRadius: 2,
          }}
        />

        {/* Badge + Metric row */}
        {(badge || metric) && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 16,
              marginBottom: 20,
              opacity: detailOpacity,
              transform: `translateY(${detailY}px)`,
            }}
          >
            {badge && (
              <span
                style={{
                  fontSize: 18,
                  fontWeight: 700,
                  color: theme.infographic.badgeText,
                  background: theme.infographic.badgeBg,
                  border: `1px solid ${accentColor}28`,
                  borderRadius: theme.radius.pill,
                  padding: '4px 16px',
                  fontFamily: theme.font.numeric,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase' as const,
                }}
              >
                {badge}
              </span>
            )}
            {metric && (
              <MetricBadge value={metric} color={accentColor} size="sm" animate />
            )}
          </div>
        )}

        {/* Detail */}
        {detail && (
          <p
            style={{
              ...detailSpec,
              fontWeight: 400,
              color: theme.color.textSecondary,
              opacity: detailOpacity,
              transform: `translateY(${detailY}px)`,
            }}
          >
            {detail}
          </p>
        )}

        {/* Caption */}
        {caption && (
          <p
            style={{
              ...captionSpec,
              color: theme.color.textMuted,
              opacity: detailOpacity,
              transform: `translateY(${detailY}px)`,
              marginTop: 12,
            }}
          >
            {caption}
          </p>
        )}
      </div>
    </AbsoluteFill>
  );
};
