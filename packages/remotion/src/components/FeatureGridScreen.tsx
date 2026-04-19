import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';
import { theme, typographyStyle } from '../theme';
import { NodeIcon } from './NodeIcon';
import { getAnimConfig, resolveSpring } from '../animation';
import type { ElementAnim } from '../animation';
import { SectionEyebrow, MetricBadge, InfographicPanel, DecorativeBackdrop } from './shared';
import type { BackdropVariant } from './shared';

interface Feature {
  icon?: string;
  title: string;
  description?: string;
  color?: string;
  emphasis?: boolean;
}

interface FeatureGridScreenProps {
  title?: string;
  features: Feature[];
  columns?: 2 | 3;
  eyebrow?: string;
  badge?: string;
  metric?: string;
  caption?: string;
  backdropVariant?: BackdropVariant;
  subtitle?: string;
  footnote?: string;
  animation?: Record<string, Partial<ElementAnim>>;
}

interface FeatureGridScreenAnim {
  title: ElementAnim;
  card: ElementAnim;
}

export const FeatureGridScreen: React.FC<FeatureGridScreenProps> = ({
  title,
  features,
  columns = 2,
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
  const a = getAnimConfig<FeatureGridScreenAnim>('FeatureGridScreen', animation);

  const titleSpring = spring({ frame, fps, config: resolveSpring(a.title?.spring) });
  const titleOpacity = interpolate(titleSpring, [0, 1], [0, 1]);
  const titleY = interpolate(titleSpring, [0, 1], [a.title?.distance?.y ?? 30, 0]);

  const baseDelay = (a.card?.baseDelay as number) ?? 10;
  const interval = a.card?.staggerInterval ?? 10;

  const cols = columns;
  const gap = cols === 3 ? 24 : 28;
  const sidePad = cols === 3 ? 80 : 120;

  const headlineSpec = typographyStyle('headline');
  const captionSpec = typographyStyle('caption');

  const hasHeader = !!(eyebrow || title || badge || metric || subtitle);

  return (
    <AbsoluteFill
      style={{
        background: theme.bg.primary,
        padding: `${hasHeader ? 70 : 80}px ${sidePad}px 70px`,
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
            <p style={{ ...captionSpec, color: theme.color.textSecondary, marginTop: 8, fontWeight: 400 }}>
              {subtitle}
            </p>
          )}
        </div>
      )}

      {/* Grid */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap,
          justifyContent: 'center',
          flex: 1,
          alignContent: 'flex-start',
        }}
      >
        {features.map((feature, i) => {
          const cardDelay = baseDelay + i * interval;
          const cardSpring = spring({
            frame: Math.max(0, frame - cardDelay),
            fps,
            config: resolveSpring(a.card?.spring),
          });
          const cardOpacity = interpolate(cardSpring, [0, 1], [0, 1]);
          const cardY = interpolate(cardSpring, [0, 1], [40, 0]);
          const cardScale = interpolate(cardSpring, [0, 1], [0.92, 1]);
          const cardColor = feature.color || theme.color.accent;
          const isEmphasis = feature.emphasis;
          const iconVariant = isEmphasis ? 'highlighted' : 'lucide-accent';

          const cardWidth =
            cols === 3
              ? `calc(${100 / 3}% - ${(gap * 2) / 3}px)`
              : `calc(50% - ${gap / 2}px)`;

          return (
            <div
              key={i}
              style={{
                width: cardWidth,
                opacity: cardOpacity,
                transform: `translateY(${cardY}px) scale(${cardScale})`,
              }}
            >
              <InfographicPanel
                variant={isEmphasis ? 'floating' : 'strong'}
                borderAccent={cardColor}
                borderPosition="top"
                style={{
                  padding: cols === 3 ? '28px 24px' : '36px 32px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 14,
                  height: '100%',
                }}
              >
                {/* Icon */}
                {feature.icon && (
                  <div
                    style={{
                      width: 62,
                      height: 62,
                      borderRadius: isEmphasis ? theme.radius.card : '50%',
                      background: isEmphasis ? cardColor : `${cardColor}16`,
                      border: `1.5px solid ${isEmphasis ? cardColor : `${cardColor}28`}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: isEmphasis ? theme.elevation.raised : theme.elevation.subtle,
                    }}
                  >
                    <NodeIcon
                      icon={feature.icon}
                      size={cols === 3 ? 32 : 36}
                      variant={iconVariant}
                      color={isEmphasis ? undefined : cardColor}
                    />
                  </div>
                )}

                <h3
                  style={{
                    fontSize: cols === 3 ? 26 : 30,
                    fontWeight: 700,
                    color: theme.color.textPrimary,
                    lineHeight: 1.3,
                    margin: 0,
                  }}
                >
                  {feature.title}
                </h3>

                {feature.description && (
                  <p
                    style={{
                      fontSize: cols === 3 ? 20 : 23,
                      color: theme.color.textSecondary,
                      lineHeight: 1.6,
                      margin: 0,
                    }}
                  >
                    {feature.description}
                  </p>
                )}
              </InfographicPanel>
            </div>
          );
        })}
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
