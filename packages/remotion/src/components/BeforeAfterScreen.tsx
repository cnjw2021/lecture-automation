import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';
import { theme, typographyStyle } from '../theme';
import { getAnimConfig, resolveSpring } from '../animation';
import type { ElementAnim } from '../animation';
import { SectionEyebrow, MetricBadge, InfographicPanel, DecorativeBackdrop } from './shared';
import type { BackdropVariant } from './shared';

interface BeforeAfterScreenProps {
  title?: string;
  before: { label: string; points: string[]; color?: string };
  after: { label: string; points: string[]; color?: string };
  eyebrow?: string;
  badge?: string;
  metric?: string;
  caption?: string;
  backdropVariant?: BackdropVariant;
  subtitle?: string;
  footnote?: string;
  animation?: Record<string, Partial<ElementAnim>>;
}

interface BeforeAfterScreenAnim {
  title: ElementAnim;
  before: ElementAnim;
  after: ElementAnim;
  arrow: ElementAnim;
}

export const BeforeAfterScreen: React.FC<BeforeAfterScreenProps> = ({
  title,
  before,
  after,
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
  const a = getAnimConfig<BeforeAfterScreenAnim>('BeforeAfterScreen', animation);

  const titleSpring = spring({ frame, fps, config: resolveSpring(a.title?.spring) });
  const titleOpacity = interpolate(titleSpring, [0, 1], [0, 1]);

  const beforeDelay = a.before?.delay ?? 8;
  const beforeSpring = spring({ frame: Math.max(0, frame - beforeDelay), fps, config: resolveSpring(a.before?.spring) });
  const beforeOpacity = interpolate(beforeSpring, [0, 1], [0, 1]);
  const beforeY = interpolate(beforeSpring, [0, 1], [-30, 0]);

  const arrowDelay = a.arrow?.delay ?? 20;
  const arrowSpring = spring({ frame: Math.max(0, frame - arrowDelay), fps, config: resolveSpring(a.arrow?.spring) });
  const arrowScale = interpolate(arrowSpring, [0, 1], [0, 1]);

  const afterDelay = a.after?.delay ?? 28;
  const afterSpring = spring({ frame: Math.max(0, frame - afterDelay), fps, config: resolveSpring(a.after?.spring) });
  const afterOpacity = interpolate(afterSpring, [0, 1], [0, 1]);
  const afterY = interpolate(afterSpring, [0, 1], [30, 0]);

  const beforeColor = before.color || theme.infographic.danger;
  const afterColor = after.color || theme.infographic.success;

  const headlineSpec = typographyStyle('headline');
  const captionSpec = typographyStyle('caption');

  const renderSection = (
    data: { label: string; points: string[] },
    color: string,
    opacity: number,
    translateY: number,
  ) => (
    <InfographicPanel
      variant="strong"
      borderAccent={color}
      borderPosition="left"
      style={{
        padding: '36px 44px',
        opacity,
        transform: `translateY(${translateY}px)`,
      }}
    >
      <div
        style={{
          display: 'inline-block',
          fontSize: 14,
          fontWeight: 800,
          color: '#fff',
          background: color,
          borderRadius: theme.radius.pill,
          padding: '3px 14px',
          marginBottom: 14,
          fontFamily: theme.font.numeric,
          letterSpacing: '0.08em',
          textTransform: 'uppercase' as const,
        }}
      >
        {data.label}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {data.points.map((pt, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: color,
                marginTop: 12,
                opacity: 0.7,
                flexShrink: 0,
              }}
            />
            <span style={{ fontSize: 30, color: theme.color.textPrimary, lineHeight: 1.5 }}>
              {pt}
            </span>
          </div>
        ))}
      </div>
    </InfographicPanel>
  );

  const hasHeader = !!(eyebrow || title || badge || metric || subtitle);

  return (
    <AbsoluteFill
      style={{
        background: theme.bg.primary,
        padding: '70px 140px',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      {backdropVariant && (
        <DecorativeBackdrop variant={backdropVariant} color={theme.color.accent} opacity={0.055} />
      )}

      {/* Header */}
      {hasHeader && (
        <div
          style={{
            marginBottom: 32,
            textAlign: 'center',
            opacity: titleOpacity,
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
            <p style={{ ...captionSpec, color: theme.color.textSecondary, marginTop: 8, fontWeight: 400 }}>
              {subtitle}
            </p>
          )}
        </div>
      )}

      {/* Fallback title when no header block */}
      {!hasHeader && title && (
        <h1
          style={{
            ...headlineSpec,
            color: theme.color.textPrimary,
            opacity: titleOpacity,
            marginBottom: 32,
            textAlign: 'center',
          }}
        >
          {title}
        </h1>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 0, alignItems: 'stretch' }}>
        {renderSection(before, beforeColor, beforeOpacity, beforeY)}

        {/* Arrow */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            padding: '10px 0',
            transform: `scale(${arrowScale})`,
          }}
        >
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: '50%',
              background: theme.infographic.panelBg,
              border: `1px solid ${theme.infographic.panelBorderStrong}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 22,
              color: theme.color.accent,
              boxShadow: theme.elevation.subtle,
            }}
          >
            ▼
          </div>
        </div>

        {renderSection(after, afterColor, afterOpacity, afterY)}
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
            <p style={{ fontSize: 18, color: theme.color.textMuted, margin: '6px 0 0', fontStyle: 'italic', textAlign: 'center' }}>
              {footnote}
            </p>
          )}
        </div>
      )}
    </AbsoluteFill>
  );
};
