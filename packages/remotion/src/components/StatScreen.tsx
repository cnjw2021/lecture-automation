import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate, Easing } from 'remotion';
import { theme, typographyStyle } from '../theme';
import { getAnimConfig, resolveSpring } from '../animation';
import type { ElementAnim } from '../animation';
import { SectionEyebrow, MetricBadge, DecorativeBackdrop } from './shared';
import type { BackdropVariant } from './shared';

interface StatScreenProps {
  value: string;
  label: string;
  description?: string;
  prefix?: string;
  suffix?: string;
  color?: string;
  eyebrow?: string;
  badge?: string;
  metric?: string;
  caption?: string;
  backdropVariant?: BackdropVariant;
  subtitle?: string;
  footnote?: string;
  animation?: Record<string, Partial<ElementAnim>>;
}

interface StatScreenAnim {
  value: ElementAnim;
  label: ElementAnim;
  description: ElementAnim;
  ring: ElementAnim;
}

export const StatScreen: React.FC<StatScreenProps> = ({
  value,
  label,
  description,
  prefix,
  suffix,
  color,
  eyebrow,
  badge,
  metric,
  caption,
  backdropVariant,
  subtitle,
  footnote,
  animation,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const a = getAnimConfig<StatScreenAnim>('StatScreen', animation);

  const accentColor = color || theme.color.accent;

  const ringSpring = spring({ frame, fps, config: resolveSpring(a.ring?.spring) });
  const ringScale = interpolate(ringSpring, [0, 1], [0, 1]);
  const ringRotation = interpolate(ringSpring, [0, 1], [-90, 0]);

  const valueDelay = a.value?.delay ?? 8;
  const valueSpring = spring({
    frame: Math.max(0, frame - valueDelay),
    fps,
    config: resolveSpring(a.value?.spring),
  });
  const valueScale = interpolate(valueSpring, [0, 1], [0.5, 1]);
  const valueOpacity = interpolate(valueSpring, [0, 1], [0, 1]);

  const numericValue = parseFloat(value);
  const isNumeric = !isNaN(numericValue);
  const countProgress = interpolate(frame, [valueDelay, valueDelay + 30], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.quad),
  });
  const displayValue = isNumeric ? Math.round(numericValue * countProgress).toString() : value;

  const labelDelay = a.label?.delay ?? 20;
  const labelSpring = spring({
    frame: Math.max(0, frame - labelDelay),
    fps,
    config: resolveSpring(a.label?.spring),
  });
  const labelOpacity = interpolate(labelSpring, [0, 1], [0, 1]);
  const labelY = interpolate(labelSpring, [0, 1], [a.label?.distance?.y ?? 30, 0]);

  const descDelay = a.description?.delay ?? 32;
  const descSpring = spring({
    frame: Math.max(0, frame - descDelay),
    fps,
    config: resolveSpring(a.description?.spring),
  });
  const descOpacity = interpolate(descSpring, [0, 1], [0, 1]);

  const metricSpec = typographyStyle('metric');
  const titleSpec = typographyStyle('title');
  const bodySpec = typographyStyle('body');
  const captionSpec = typographyStyle('caption');

  return (
    <AbsoluteFill
      style={{
        background: theme.bg.primary,
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
      }}
    >
      {backdropVariant && (
        <DecorativeBackdrop variant={backdropVariant} color={accentColor} opacity={0.055} />
      )}

      {/* Decorative rings */}
      <div
        style={{
          position: 'absolute',
          width: 660,
          height: 660,
          borderRadius: '50%',
          border: `4px solid ${accentColor}`,
          opacity: 0.12,
          transform: `scale(${ringScale}) rotate(${ringRotation}deg)`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          width: 780,
          height: 780,
          borderRadius: '50%',
          border: `2px dashed ${accentColor}`,
          opacity: 0.08,
          transform: `scale(${ringScale})`,
        }}
      />

      {/* Glow */}
      <div
        style={{
          position: 'absolute',
          width: 920,
          height: 920,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${accentColor}18 0%, transparent 65%)`,
          transform: `scale(${ringScale})`,
        }}
      />

      {/* Top: eyebrow / badge / metric strip */}
      {(eyebrow || badge || metric) && (
        <div
          style={{
            position: 'absolute',
            top: 56,
            left: 0,
            right: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 10,
            opacity: labelOpacity,
          }}
        >
          {eyebrow && <SectionEyebrow text={eyebrow} color={accentColor} />}
          <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
            {badge && (
              <span
                style={{
                  fontSize: 17,
                  fontWeight: 700,
                  color: theme.infographic.badgeText,
                  background: theme.infographic.badgeBg,
                  border: `1px solid ${accentColor}28`,
                  borderRadius: theme.radius.pill,
                  padding: '4px 14px',
                  fontFamily: theme.font.numeric,
                  textTransform: 'uppercase' as const,
                  letterSpacing: '0.04em',
                }}
              >
                {badge}
              </span>
            )}
            {metric && <MetricBadge value={metric} color={accentColor} size="sm" />}
          </div>
        </div>
      )}

      {/* Main content */}
      <div
        style={{ position: 'relative', zIndex: 1, textAlign: 'center', padding: '0 140px', maxWidth: 1200 }}
      >
        {/* Big value */}
        <div
          style={{
            opacity: valueOpacity,
            transform: `scale(${valueScale})`,
            marginBottom: 20,
          }}
        >
          <span
            style={{
              ...metricSpec,
              color: accentColor,
              letterSpacing: '-0.04em',
            }}
          >
            {prefix && (
              <span style={{ fontSize: (metricSpec.fontSize as number) * 0.55, opacity: 0.75, marginRight: 6 }}>
                {prefix}
              </span>
            )}
            {displayValue}
            {suffix && (
              <span style={{ fontSize: (metricSpec.fontSize as number) * 0.55, opacity: 0.75, marginLeft: 6 }}>
                {suffix}
              </span>
            )}
          </span>
        </div>

        {/* Divider */}
        <div
          style={{
            width: interpolate(labelSpring, [0, 1], [0, 100]),
            height: 3,
            background: accentColor,
            margin: '0 auto 24px',
            borderRadius: 2,
            opacity: 0.6,
          }}
        />

        {/* Label */}
        <h2
          style={{
            ...titleSpec,
            color: theme.color.textPrimary,
            opacity: labelOpacity,
            transform: `translateY(${labelY}px)`,
            marginBottom: 14,
          }}
        >
          {label}
        </h2>

        {/* Subtitle */}
        {subtitle && (
          <p
            style={{
              ...captionSpec,
              color: theme.color.textSecondary,
              opacity: labelOpacity,
              marginBottom: 14,
            }}
          >
            {subtitle}
          </p>
        )}

        {/* Description */}
        {description && (
          <p
            style={{
              ...bodySpec,
              fontWeight: 400,
              color: theme.color.textSecondary,
              opacity: descOpacity,
            }}
          >
            {description}
          </p>
        )}

        {/* Caption / Footnote */}
        {(caption || footnote) && (
          <div
            style={{
              marginTop: 24,
              borderTop: `1px solid ${theme.infographic.panelBorder}`,
              paddingTop: 14,
              opacity: descOpacity,
            }}
          >
            {caption && (
              <p style={{ ...captionSpec, color: theme.color.textMuted, margin: 0 }}>{caption}</p>
            )}
            {footnote && (
              <p style={{ fontSize: 18, color: theme.color.textMuted, margin: '6px 0 0', fontStyle: 'italic' }}>
                {footnote}
              </p>
            )}
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};
