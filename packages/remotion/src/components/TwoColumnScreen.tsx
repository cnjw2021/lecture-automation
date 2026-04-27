import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';
import { theme, typographyStyle } from '../theme';
import { NodeIcon } from './NodeIcon';
import { getAnimConfig, resolveSpring } from '../animation';
import type { ElementAnim } from '../animation';
import { SectionEyebrow, MetricBadge, InfographicPanel, DecorativeBackdrop } from './shared';
import type { BackdropVariant } from './shared';

interface Column {
  title: string;
  body: string;
  icon?: string;
  color?: string;
}

interface TwoColumnScreenProps {
  title?: string;
  left: Column;
  right: Column;
  eyebrow?: string;
  badge?: string;
  metric?: string;
  caption?: string;
  backdropVariant?: BackdropVariant;
  subtitle?: string;
  footnote?: string;
  animation?: Record<string, Partial<ElementAnim>>;
}

interface TwoColumnScreenAnim {
  title: ElementAnim;
  left: ElementAnim;
  right: ElementAnim;
}

export const TwoColumnScreen: React.FC<TwoColumnScreenProps> = ({
  title,
  left,
  right,
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
  const a = getAnimConfig<TwoColumnScreenAnim>('TwoColumnScreen', animation);

  const titleSpring = spring({ frame, fps, config: resolveSpring(a.title?.spring) });
  const titleOpacity = interpolate(titleSpring, [0, 1], [0, 1]);
  const titleY = interpolate(titleSpring, [0, 1], [30, 0]);

  const leftDelay = a.left?.delay ?? 8;
  const leftSpring = spring({
    frame: Math.max(0, frame - leftDelay),
    fps,
    config: resolveSpring(a.left?.spring),
  });
  const leftOpacity = interpolate(leftSpring, [0, 1], [0, 1]);
  const leftX = interpolate(leftSpring, [0, 1], [-50, 0]);

  const rightDelay = a.right?.delay ?? 16;
  const rightSpring = spring({
    frame: Math.max(0, frame - rightDelay),
    fps,
    config: resolveSpring(a.right?.spring),
  });
  const rightOpacity = interpolate(rightSpring, [0, 1], [0, 1]);
  const rightX = interpolate(rightSpring, [0, 1], [50, 0]);

  const headlineSpec = typographyStyle('headline');
  const captionSpec = typographyStyle('caption');
  const bodySpec = typographyStyle('body');

  const renderCol = (col: Column, opacity: number, translateX: number) => {
    const colColor = col.color || theme.color.accent;
    return (
      <div
        style={{
          flex: 1,
          opacity,
          transform: `translateX(${translateX}px)`,
        }}
      >
        <InfographicPanel
          variant="strong"
          borderAccent={colColor}
          borderPosition="top"
          style={{ padding: '36px 40px', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}
        >
          {col.icon && (
            <div style={{ marginBottom: 20 }}>
              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: '50%',
                  background: `${colColor}16`,
                  border: `1.5px solid ${colColor}28`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: theme.elevation.subtle,
                }}
              >
                <NodeIcon icon={col.icon} size={36} variant="lucide-accent" color={colColor} />
              </div>
            </div>
          )}
          <h2
            style={{
              fontSize: 36,
              fontWeight: 700,
              color: theme.color.textPrimary,
              marginBottom: 16,
              lineHeight: 1.3,
            }}
          >
            {col.title}
          </h2>
          <div
            style={{
              width: 56,
              height: 3,
              background: colColor,
              borderRadius: 2,
              marginBottom: 18,
              opacity: 0.6,
            }}
          />
          <p
            style={{
              ...bodySpec,
              fontWeight: 400,
              color: theme.color.textSecondary,
              lineHeight: 1.7,
              margin: 0,
              whiteSpace: 'pre-wrap',
            }}
          >
            {col.body}
          </p>
        </InfographicPanel>
      </div>
    );
  };

  const hasHeader = !!(eyebrow || title || badge || metric || subtitle);

  return (
    <AbsoluteFill
      style={{ background: theme.bg.primary, padding: '70px 100px', overflow: 'hidden' }}
    >
      {backdropVariant && (
        <DecorativeBackdrop variant={backdropVariant} color={theme.color.accent} opacity={0.055} />
      )}

      {/* Header */}
      {hasHeader && (
        <div
          style={{
            marginBottom: 36,
            textAlign: 'center',
            opacity: titleOpacity,
            transform: `translateY(${titleY}px)`,
          }}
        >
          {eyebrow && <SectionEyebrow text={eyebrow} style={{ textAlign: 'center' }} />}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 18 }}>
            {title && (
              <h1 style={{ ...headlineSpec, color: theme.color.textPrimary, margin: 0 }}>
                {title}
              </h1>
            )}
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
                  fontFamily: theme.font.numeric,
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
            <p
              style={{
                ...captionSpec,
                color: theme.color.textSecondary,
                marginTop: 8,
                fontWeight: 400,
              }}
            >
              {subtitle}
            </p>
          )}
        </div>
      )}

      {/* Columns */}
      <div
        style={{
          display: 'flex',
          flex: 1,
          alignItems: 'stretch',
          gap: 28,
        }}
      >
        {renderCol(left, leftOpacity, leftX)}
        {renderCol(right, rightOpacity, rightX)}
      </div>

      {/* Caption / Footnote */}
      {(caption || footnote) && (
        <div
          style={{
            marginTop: 20,
            opacity: titleOpacity,
            borderTop: `1px solid ${theme.infographic.panelBorder}`,
            paddingTop: 12,
          }}
        >
          {caption && (
            <p style={{ ...captionSpec, color: theme.color.textMuted, margin: 0, textAlign: 'center' }}>
              {caption}
            </p>
          )}
          {footnote && (
            <p
              style={{ fontSize: 18, color: theme.color.textMuted, margin: '6px 0 0', fontStyle: 'italic', textAlign: 'center' }}
            >
              {footnote}
            </p>
          )}
        </div>
      )}
    </AbsoluteFill>
  );
};
