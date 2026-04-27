import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';
import { theme, typographyStyle } from '../theme';
import { NodeIcon } from './NodeIcon';
import { getAnimConfig, resolveSpring } from '../animation';
import type { ElementAnim } from '../animation';
import { SectionEyebrow, MetricBadge, InfographicPanel, DecorativeBackdrop } from './shared';
import type { BackdropVariant } from './shared';

interface BulletItem {
  title: string;
  detail: string;
  icon?: string;
  color?: string;
}

interface BulletDetailScreenProps {
  title?: string;
  items: BulletItem[];
  eyebrow?: string;
  badge?: string;
  metric?: string;
  caption?: string;
  backdropVariant?: BackdropVariant;
  footnote?: string;
  animation?: Record<string, Partial<ElementAnim>>;
}

interface BulletDetailScreenAnim {
  title: ElementAnim;
  item: ElementAnim;
}

export const BulletDetailScreen: React.FC<BulletDetailScreenProps> = ({
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
  const a = getAnimConfig<BulletDetailScreenAnim>('BulletDetailScreen', animation);

  const titleSpring = spring({ frame, fps, config: resolveSpring(a.title?.spring) });
  const titleOpacity = interpolate(titleSpring, [0, 1], [0, 1]);
  const titleY = interpolate(titleSpring, [0, 1], [30, 0]);

  const baseDelay = (a.item?.baseDelay as number) ?? 10;
  const interval = a.item?.staggerInterval ?? 16;

  const headlineSpec = typographyStyle('headline');
  const captionSpec = typographyStyle('caption');

  const hasHeader = !!(eyebrow || title || badge || metric);
  const topPad = hasHeader ? 70 : 80;

  return (
    <AbsoluteFill
      style={{ background: theme.bg.primary, padding: `${topPad}px 120px 80px`, overflow: 'hidden' }}
    >
      {backdropVariant && (
        <DecorativeBackdrop variant={backdropVariant} color={theme.color.accent} opacity={0.055} />
      )}

      {/* Header block */}
      {hasHeader && (
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

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, flex: 1, justifyContent: 'center' }}>
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

          return (
            <div
              key={i}
              style={{
                opacity: itemOpacity,
                transform: `translateX(${itemX}px)`,
              }}
            >
              <InfographicPanel
                variant="strong"
                borderAccent={itemColor}
                borderPosition="left"
                style={{ padding: '22px 32px' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                  {item.icon && (
                    <div
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: theme.radius.card,
                        background: `${itemColor}16`,
                        border: `1.5px solid ${itemColor}26`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <NodeIcon icon={item.icon} size={28} variant="lucide-accent" color={itemColor} />
                    </div>
                  )}
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
                    <p
                      style={{
                        fontSize: 23,
                        color: theme.color.textSecondary,
                        lineHeight: 1.6,
                        margin: '6px 0 0',
                      }}
                    >
                      {item.detail}
                    </p>
                  </div>
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
            <p
              style={{
                fontSize: 18,
                color: theme.color.textMuted,
                margin: '8px 0 0',
                fontStyle: 'italic',
              }}
            >
              {footnote}
            </p>
          )}
        </div>
      )}
    </AbsoluteFill>
  );
};
