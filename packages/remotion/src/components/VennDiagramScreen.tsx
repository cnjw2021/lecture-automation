import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';
import { theme, typographyStyle } from '../theme';
import { getAnimConfig, resolveSpring } from '../animation';
import type { ElementAnim } from '../animation';
import { SectionEyebrow, MetricBadge, DecorativeBackdrop } from './shared';
import type { BackdropVariant } from './shared';

interface VennCircle {
  label: string;
  color?: string;
}

interface VennDiagramScreenProps {
  title?: string;
  left: VennCircle;
  right: VennCircle;
  intersection: string;
  eyebrow?: string;
  badge?: string;
  metric?: string;
  caption?: string;
  backdropVariant?: BackdropVariant;
  subtitle?: string;
  footnote?: string;
  animation?: Record<string, Partial<ElementAnim>>;
}

interface VennDiagramScreenAnim {
  title: ElementAnim;
  circle: ElementAnim;
  intersection: ElementAnim;
}

export const VennDiagramScreen: React.FC<VennDiagramScreenProps> = ({
  title,
  left,
  right,
  intersection,
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
  const a = getAnimConfig<VennDiagramScreenAnim>('VennDiagramScreen', animation);

  const titleSpring = spring({ frame, fps, config: resolveSpring(a.title?.spring) });
  const titleOpacity = interpolate(titleSpring, [0, 1], [0, 1]);

  const circleDelay = a.circle?.delay ?? 8;
  const circleSpring = spring({ frame: Math.max(0, frame - circleDelay), fps, config: resolveSpring(a.circle?.spring) });
  const circleScale = interpolate(circleSpring, [0, 1], [0, 1]);

  const intDelay = a.intersection?.delay ?? 25;
  const intSpring = spring({ frame: Math.max(0, frame - intDelay), fps, config: resolveSpring(a.intersection?.spring) });
  const intOpacity = interpolate(intSpring, [0, 1], [0, 1]);
  const intScale = interpolate(intSpring, [0, 1], [0.8, 1]);

  const leftColor = left.color || theme.color.accent;
  const rightColor = right.color || theme.color.accentSecondary;
  const r = 320;
  const overlap = 140;

  const headlineSpec = typographyStyle('headline');
  const captionSpec = typographyStyle('caption');
  const hasHeader = !!(eyebrow || title || badge || metric || subtitle);

  return (
    <AbsoluteFill
      style={{ background: theme.bg.primary, padding: '60px 100px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
    >
      {backdropVariant && (
        <DecorativeBackdrop variant={backdropVariant} color={theme.color.accent} opacity={0.05} />
      )}

      {/* Header */}
      {hasHeader && (
        <div style={{ textAlign: 'center', opacity: titleOpacity, marginBottom: 24 }}>
          {eyebrow && <SectionEyebrow text={eyebrow} style={{ textAlign: 'center' }} />}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
            {title && (
              <h1 style={{ ...headlineSpec, color: theme.color.textPrimary, margin: 0 }}>{title}</h1>
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

      {/* Fallback title */}
      {!hasHeader && title && (
        <h1 style={{ ...headlineSpec, color: theme.color.textPrimary, opacity: titleOpacity, textAlign: 'center', marginBottom: 24 }}>
          {title}
        </h1>
      )}

      {/* Venn diagram */}
      <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <div style={{ position: 'relative', width: r * 2 * 2 - overlap, height: r * 2 }}>
          {/* Left circle */}
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              width: r * 2,
              height: r * 2,
              borderRadius: '50%',
              background: `${leftColor}16`,
              border: `2.5px solid ${leftColor}44`,
              transform: `scale(${circleScale})`,
              transformOrigin: 'center',
              display: 'flex',
              alignItems: 'center',
              paddingLeft: 52,
              boxShadow: `inset 0 0 60px ${leftColor}0a`,
            }}
          >
            <span
              style={{
                fontSize: 38,
                fontWeight: 700,
                color: leftColor,
                maxWidth: 220,
                textAlign: 'center',
                lineHeight: 1.35,
                fontFamily: theme.font.base,
              }}
            >
              {left.label}
            </span>
          </div>

          {/* Right circle */}
          <div
            style={{
              position: 'absolute',
              right: 0,
              top: 0,
              width: r * 2,
              height: r * 2,
              borderRadius: '50%',
              background: `${rightColor}16`,
              border: `2.5px solid ${rightColor}44`,
              transform: `scale(${circleScale})`,
              transformOrigin: 'center',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              paddingRight: 52,
              boxShadow: `inset 0 0 60px ${rightColor}0a`,
            }}
          >
            <span
              style={{
                fontSize: 38,
                fontWeight: 700,
                color: rightColor,
                maxWidth: 220,
                textAlign: 'center',
                lineHeight: 1.35,
                fontFamily: theme.font.base,
              }}
            >
              {right.label}
            </span>
          </div>

          {/* Intersection label */}
          <div
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              transform: `translate(-50%, -50%) scale(${intScale})`,
              opacity: intOpacity,
              textAlign: 'center',
              zIndex: 2,
            }}
          >
            <div
              style={{
                padding: '18px 32px',
                borderRadius: theme.radius.card,
                background: theme.infographic.panelBgStrong,
                border: `1px solid ${theme.infographic.panelBorderStrong}`,
                boxShadow: theme.elevation.raised,
              }}
            >
              <span
                style={{
                  fontSize: 32,
                  fontWeight: 700,
                  color: theme.color.textPrimary,
                  fontFamily: theme.font.base,
                  lineHeight: 1.35,
                }}
              >
                {intersection}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Caption / Footnote */}
      {(caption || footnote) && (
        <div
          style={{
            marginTop: 16,
            opacity: titleOpacity,
            borderTop: `1px solid ${theme.infographic.panelBorder}`,
            paddingTop: 12,
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
