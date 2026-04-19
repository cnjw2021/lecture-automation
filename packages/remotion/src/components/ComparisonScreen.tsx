import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';
import { theme, typographyStyle } from '../theme';
import { getAnimConfig, resolveSpring, type ComparisonScreenAnim } from '../animation';
import { SectionEyebrow, MetricBadge, InfographicPanel, DecorativeBackdrop } from './shared';
import type { BackdropVariant } from './shared';

interface Side {
  title: string;
  points: string[];
  color?: string;
}

interface ComparisonScreenProps {
  left: Side;
  right: Side;
  vsLabel?: string;
  eyebrow?: string;
  badge?: string;
  metric?: string;
  caption?: string;
  backdropVariant?: BackdropVariant;
  subtitle?: string;
  footnote?: string;
  animation?: Partial<Record<keyof ComparisonScreenAnim, Record<string, unknown>>>;
}

export const ComparisonScreen: React.FC<ComparisonScreenProps> = ({
  left,
  right,
  vsLabel = 'VS',
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
  const a = getAnimConfig<ComparisonScreenAnim>('ComparisonScreen', animation);

  const leftSpring = spring({ frame, fps, config: resolveSpring(a.left.spring) });
  const leftX = interpolate(leftSpring, [0, 1], [a.left.distance?.x ?? -120, 0]);
  const leftOpacity = interpolate(leftSpring, [0, 1], [0, 1]);

  const rightSpring = spring({
    frame: Math.max(0, frame - (a.right.delay ?? 8)),
    fps,
    config: resolveSpring(a.right.spring),
  });
  const rightX = interpolate(rightSpring, [0, 1], [a.right.distance?.x ?? 120, 0]);
  const rightOpacity = interpolate(rightSpring, [0, 1], [0, 1]);

  const vsSpring = spring({
    frame: Math.max(0, frame - (a.vs.delay ?? 15)),
    fps,
    config: resolveSpring(a.vs.spring),
  });
  const vsScaleRange = a.vs.scale ?? [0, 1];
  const vsScale = interpolate(vsSpring, [0, 1], vsScaleRange);

  const pointBaseDelay = (a.point.baseDelay as number[]) ?? [20, 28];
  const pointInterval = a.point.staggerInterval ?? 15;

  const headlineSpring = spring({ frame, fps, config: resolveSpring(a.left.spring) });
  const headerOpacity = interpolate(headlineSpring, [0, 1], [0, 1]);

  const captionSpec = typographyStyle('caption');

  const hasHeader = !!(eyebrow || badge || metric || subtitle);

  const renderSide = (side: Side, index: number) => {
    const isLeft = index === 0;
    const sideColor = side.color || (isLeft ? theme.color.accent : theme.color.accentSecondary);

    return (
      <InfographicPanel
        variant="strong"
        borderAccent={sideColor}
        borderPosition="top"
        style={{
          flex: 1,
          padding: '44px 40px',
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
        }}
      >
        <h2
          style={{
            fontSize: 44,
            fontWeight: 800,
            color: sideColor,
            marginBottom: 28,
            textAlign: 'center',
          }}
        >
          {side.title}
        </h2>

        <div
          style={{
            width: 72,
            height: 3,
            background: sideColor,
            margin: '0 auto 28px',
            borderRadius: 2,
            opacity: 0.6,
          }}
        />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
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
                  gap: 14,
                  opacity: pointOpacity,
                }}
              >
                <div
                  style={{
                    minWidth: 10,
                    height: 10,
                    borderRadius: '50%',
                    background: sideColor,
                    marginTop: 14,
                    opacity: 0.7,
                    flexShrink: 0,
                  }}
                />
                <span style={{ fontSize: 30, color: theme.color.textPrimary, lineHeight: 1.5 }}>
                  {point}
                </span>
              </div>
            );
          })}
        </div>
      </InfographicPanel>
    );
  };

  return (
    <AbsoluteFill
      style={{ background: theme.bg.primary, overflow: 'hidden' }}
    >
      {backdropVariant && (
        <DecorativeBackdrop variant={backdropVariant} color={theme.color.accent} opacity={0.055} />
      )}

      {/* Top header */}
      {hasHeader && (
        <div
          style={{
            position: 'absolute',
            top: 40,
            left: 0,
            right: 0,
            textAlign: 'center',
            opacity: headerOpacity,
            padding: '0 120px',
            zIndex: 1,
          }}
        >
          {eyebrow && <SectionEyebrow text={eyebrow} style={{ textAlign: 'center' }} />}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
            {badge && (
              <span
                style={{
                  fontSize: 17,
                  fontWeight: 700,
                  color: theme.infographic.badgeText,
                  background: theme.infographic.badgeBg,
                  border: `1px solid ${theme.infographic.panelBorder}`,
                  borderRadius: theme.radius.pill,
                  padding: '4px 14px',
                  fontFamily: 'Inter, sans-serif',
                  textTransform: 'uppercase' as const,
                  letterSpacing: '0.04em',
                }}
              >
                {badge}
              </span>
            )}
            {metric && (
              <MetricBadge value={metric} color={theme.color.accent} size="sm" animate />
            )}
          </div>
          {subtitle && (
            <p style={{ ...captionSpec, color: theme.color.textSecondary, marginTop: 6, fontWeight: 400 }}>
              {subtitle}
            </p>
          )}
        </div>
      )}

      <div
        style={{
          display: 'flex',
          width: '100%',
          height: '100%',
          alignItems: 'center',
          padding: `${hasHeader ? 120 : 60}px 60px 60px`,
          gap: 0,
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
            gap: 16,
            zIndex: 2,
            flexShrink: 0,
          }}
        >
          <div
            style={{
              width: 2,
              height: 160,
              background: theme.infographic.panelBorderStrong,
            }}
          />
          <div
            style={{
              width: 76,
              height: 76,
              borderRadius: '50%',
              background: theme.infographic.panelBg,
              border: `2px solid ${theme.infographic.panelBorderStrong}`,
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              fontSize: 26,
              fontWeight: 800,
              color: theme.color.textPrimary,
              transform: `scale(${vsScale})`,
              boxShadow: theme.elevation.raised,
              fontFamily: 'Inter, sans-serif',
            }}
          >
            {vsLabel}
          </div>
          <div
            style={{
              width: 2,
              height: 160,
              background: theme.infographic.panelBorderStrong,
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

      {/* Footnote / Caption */}
      {(caption || footnote) && (
        <div
          style={{
            position: 'absolute',
            bottom: 40,
            left: 120,
            right: 120,
            borderTop: `1px solid ${theme.infographic.panelBorder}`,
            paddingTop: 12,
            opacity: headerOpacity,
            textAlign: 'center',
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
    </AbsoluteFill>
  );
};
