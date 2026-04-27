import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';
import { theme, typographyStyle } from '../theme';
import { NodeIcon } from './NodeIcon';
import { getAnimConfig, resolveSpring } from '../animation';
import type { ElementAnim } from '../animation';
import { SectionEyebrow, MetricBadge, InfographicPanel, DecorativeBackdrop } from './shared';
import type { BackdropVariant } from './shared';

interface IconItem {
  icon: string;
  title: string;
  description?: string;
  color?: string;
  badge?: string;
  metric?: string;
  emphasis?: boolean;
}

interface IconListScreenProps {
  title?: string;
  items: IconItem[];
  eyebrow?: string;
  badge?: string;
  metric?: string;
  caption?: string;
  backdropVariant?: BackdropVariant;
  footnote?: string;
  animation?: Record<string, Partial<ElementAnim>>;
}

interface IconListScreenAnim {
  title: ElementAnim;
  item: ElementAnim;
}

export const IconListScreen: React.FC<IconListScreenProps> = ({
  title,
  items,
  eyebrow,
  badge,
  metric,
  caption,
  backdropVariant,
  footnote,
  animation,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const a = getAnimConfig<IconListScreenAnim>('IconListScreen', animation);

  const titleSpring = spring({ frame, fps, config: resolveSpring(a.title?.spring) });
  const titleOpacity = interpolate(titleSpring, [0, 1], [0, 1]);
  const titleY = interpolate(titleSpring, [0, 1], [30, 0]);

  const baseDelay = (a.item?.baseDelay as number) ?? 10;
  const interval = a.item?.staggerInterval ?? 14;

  const headlineSpec = typographyStyle('headline');
  const captionSpec = typographyStyle('caption');

  return (
    <AbsoluteFill
      style={{ background: theme.bg.primary, padding: '80px 120px', overflow: 'hidden' }}
    >
      {backdropVariant && (
        <DecorativeBackdrop variant={backdropVariant} color={theme.color.accent} opacity={0.055} />
      )}

      {/* Header */}
      {(eyebrow || title || badge || metric) && (
        <div
          style={{
            marginBottom: 40,
            opacity: titleOpacity,
            transform: `translateY(${titleY}px)`,
          }}
        >
          {eyebrow && <SectionEyebrow text={eyebrow} />}
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            {title && (
              <h1 style={{ ...headlineSpec, color: theme.color.textPrimary, margin: 0, flex: 1 }}>
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
                  flexShrink: 0,
                }}
              >
                {badge}
              </span>
            )}
            {metric && (
              <MetricBadge value={metric} color={theme.color.accent} size="sm" animate />
            )}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 18, flex: 1, justifyContent: 'center' }}>
        {items.map((item, i) => {
          const itemDelay = baseDelay + i * interval;
          const itemSpring = spring({
            frame: Math.max(0, frame - itemDelay),
            fps,
            config: resolveSpring(a.item?.spring),
          });
          const itemOpacity = interpolate(itemSpring, [0, 1], [0, 1]);
          const itemX = interpolate(itemSpring, [0, 1], [-40, 0]);
          const itemColor = item.color || theme.color.accent;
          const isEmphasis = item.emphasis;
          const iconVariant = isEmphasis ? 'highlighted' : 'lucide-accent';

          return (
            <div
              key={i}
              style={{
                opacity: itemOpacity,
                transform: `translateX(${itemX}px)`,
              }}
            >
              <InfographicPanel
                variant={isEmphasis ? 'floating' : 'strong'}
                style={{ padding: '18px 28px' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                  {/* Icon badge */}
                  <div
                    style={{
                      width: 62,
                      height: 62,
                      borderRadius: isEmphasis ? theme.radius.card : '50%',
                      background: isEmphasis ? itemColor : `${itemColor}16`,
                      border: `1.5px solid ${isEmphasis ? itemColor : `${itemColor}28`}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      boxShadow: isEmphasis ? theme.elevation.raised : theme.elevation.subtle,
                    }}
                  >
                    <NodeIcon icon={item.icon} size={34} variant={iconVariant} color={isEmphasis ? undefined : itemColor} />
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h3
                      style={{
                        fontSize: 30,
                        fontWeight: 700,
                        color: theme.color.textPrimary,
                        margin: 0,
                        lineHeight: 1.3,
                      }}
                    >
                      {item.title}
                    </h3>
                    {item.description && (
                      <p
                        style={{
                          fontSize: 22,
                          color: theme.color.textSecondary,
                          lineHeight: 1.5,
                          margin: '4px 0 0',
                        }}
                      >
                        {item.description}
                      </p>
                    )}
                  </div>

                  {/* Item-level badge/metric */}
                  {(item.badge || item.metric) && (
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexShrink: 0 }}>
                      {item.badge && (
                        <span
                          style={{
                            fontSize: 15,
                            fontWeight: 700,
                            color: theme.infographic.badgeText,
                            background: theme.infographic.badgeBg,
                            border: `1px solid ${itemColor}28`,
                            borderRadius: theme.radius.pill,
                            padding: '3px 12px',
                            fontFamily: theme.font.numeric,
                            textTransform: 'uppercase' as const,
                          }}
                        >
                          {item.badge}
                        </span>
                      )}
                      {item.metric && (
                        <MetricBadge value={item.metric} color={itemColor} size="sm" />
                      )}
                    </div>
                  )}
                </div>
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
            <p style={{ ...captionSpec, color: theme.color.textMuted, margin: 0 }}>{caption}</p>
          )}
          {footnote && (
            <p style={{ fontSize: 18, color: theme.color.textMuted, margin: '8px 0 0', fontStyle: 'italic' }}>
              {footnote}
            </p>
          )}
        </div>
      )}
    </AbsoluteFill>
  );
};
