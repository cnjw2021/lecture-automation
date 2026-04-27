import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';
import { theme, typographyStyle } from '../theme';
import { getAnimConfig, resolveSpring } from '../animation';
import type { ElementAnim } from '../animation';
import { SectionEyebrow, MetricBadge, DecorativeBackdrop } from './shared';
import type { BackdropVariant } from './shared';

interface FlexItem {
  label: string;
  color?: string;
  size?: number; // relative size hint
}

type FlexDirection = 'row' | 'row-reverse' | 'column' | 'column-reverse';
type FlexWrap = 'nowrap' | 'wrap';
type FlexJustify = 'flex-start' | 'flex-end' | 'center' | 'space-between' | 'space-around' | 'space-evenly';
type FlexAlign = 'flex-start' | 'flex-end' | 'center' | 'stretch' | 'baseline';

interface FlexLayoutDiagramScreenProps {
  items: FlexItem[];
  direction: FlexDirection;
  title?: string;
  containerLabel?: string;
  mainAxisLabel?: string;
  crossAxisLabel?: string;
  properties?: Record<string, string>;
  wrap?: FlexWrap;
  justifyContent?: FlexJustify;
  alignItems?: FlexAlign;
  caption?: string;
  eyebrow?: string;
  badge?: string;
  metric?: string;
  backdropVariant?: BackdropVariant;
  subtitle?: string;
  footnote?: string;
  animation?: Record<string, Partial<ElementAnim>>;
}

interface FlexLayoutAnim {
  title: ElementAnim;
  container: ElementAnim;
  item: ElementAnim;
}

export const FlexLayoutDiagramScreen: React.FC<FlexLayoutDiagramScreenProps> = ({
  items,
  direction,
  title,
  containerLabel = 'flex container',
  mainAxisLabel,
  crossAxisLabel,
  properties = {},
  wrap = 'nowrap',
  justifyContent = 'flex-start',
  alignItems = 'stretch',
  caption,
  eyebrow,
  badge,
  metric,
  backdropVariant,
  subtitle,
  footnote,
  animation,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const a = getAnimConfig<FlexLayoutAnim>('FlexLayoutDiagramScreen', animation);

  const titleSpring = spring({ frame, fps, config: resolveSpring(a.title?.spring) });
  const titleOpacity = interpolate(titleSpring, [0, 1], [0, 1]);

  const containerDelay = a.container?.delay ?? 8;
  const containerSpring = spring({ frame: Math.max(0, frame - containerDelay), fps, config: resolveSpring(a.container?.spring) });
  const containerOpacity = interpolate(containerSpring, [0, 1], [0, 1]);

  const itemBaseDelay = (a.item?.baseDelay as number) ?? 18;
  const itemInterval = a.item?.staggerInterval ?? 8;

  const headlineSpec = typographyStyle('headline');
  const captionSpec = typographyStyle('caption');
  const hasHeader = !!(eyebrow || title || badge || metric || subtitle);

  const isRow = direction === 'row' || direction === 'row-reverse';
  const mainAxis = mainAxisLabel || (isRow ? '主軸 main →' : '主軸 main ↓');
  const crossAxis = crossAxisLabel || (isRow ? '交差軸 cross ↓' : '交差軸 cross →');

  const propsList = Object.entries(properties);

  return (
    <AbsoluteFill
      style={{ background: theme.bg.primary, padding: '60px 80px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
    >
      {backdropVariant && (
        <DecorativeBackdrop variant={backdropVariant} color={theme.color.accent} opacity={0.05} />
      )}

      {/* Header */}
      {hasHeader && (
        <div style={{ textAlign: 'center', opacity: titleOpacity, marginBottom: 28 }}>
          {eyebrow && <SectionEyebrow text={eyebrow} style={{ textAlign: 'center' }} />}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
            {title && <h1 style={{ ...headlineSpec, color: theme.color.textPrimary, margin: 0 }}>{title}</h1>}
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
            {metric && <MetricBadge value={metric} color={theme.color.accent} size="sm" animate />}
          </div>
          {subtitle && (
            <p style={{ ...captionSpec, color: theme.color.textSecondary, marginTop: 8, fontWeight: 400 }}>
              {subtitle}
            </p>
          )}
        </div>
      )}

      {/* Diagram area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 24, justifyContent: 'center' }}>
        {/* Properties chips */}
        {propsList.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center' }}>
            {propsList.map(([k, v]) => (
              <span
                key={k}
                style={{
                  fontSize: 18,
                  fontFamily: "'SF Mono', 'Fira Code', 'Consolas', monospace",
                  background: theme.bg.code,
                  border: `1px solid ${theme.color.divider}`,
                  padding: '6px 14px',
                  borderRadius: 10,
                  color: theme.color.textPrimary,
                }}
              >
                <span style={{ color: theme.color.accent, fontWeight: 700 }}>{k}</span>
                <span style={{ color: theme.color.textMuted }}>: </span>
                <span style={{ color: theme.color.textPrimary }}>{v}</span>
              </span>
            ))}
          </div>
        )}

        {/* Container with axis labels */}
        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          {/* Main axis label (top of row) */}
          {isRow && (
            <div style={{ fontSize: 16, fontWeight: 700, color: theme.color.accent, letterSpacing: '0.06em', textTransform: 'uppercase' as const, fontFamily: theme.font.numeric }}>
              {mainAxis}
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 16, width: '100%', justifyContent: 'center' }}>
            {/* Cross axis label (left for row) */}
            {isRow && (
              <div style={{ writingMode: 'vertical-rl' as const, transform: 'rotate(180deg)', fontSize: 16, fontWeight: 700, color: theme.color.accentSecondary, letterSpacing: '0.06em', textTransform: 'uppercase' as const, fontFamily: theme.font.numeric }}>
                {crossAxis}
              </div>
            )}
            {/* Main axis label (top of column) */}
            {!isRow && (
              <div style={{ fontSize: 16, fontWeight: 700, color: theme.color.accent, letterSpacing: '0.06em', textTransform: 'uppercase' as const, fontFamily: theme.font.numeric, alignSelf: 'flex-start' }}>
                {mainAxis}
              </div>
            )}

            {/* Container box */}
            <div
              style={{
                flex: 1,
                maxWidth: 1320,
                minHeight: isRow ? 320 : 460,
                background: `${theme.color.accent}0a`,
                border: `2px dashed ${theme.color.accent}80`,
                borderRadius: 18,
                padding: 24,
                display: 'flex',
                flexDirection: direction,
                flexWrap: wrap,
                justifyContent,
                alignItems,
                gap: 16,
                opacity: containerOpacity,
                position: 'relative',
              }}
            >
              {/* Container label */}
              <div
                style={{
                  position: 'absolute',
                  top: -14,
                  left: 24,
                  background: theme.bg.primary,
                  padding: '2px 12px',
                  fontSize: 14,
                  fontWeight: 700,
                  color: theme.color.accent,
                  fontFamily: theme.font.numeric,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase' as const,
                }}
              >
                {containerLabel}
              </div>

              {items.map((item, i) => {
                const itemDelay = itemBaseDelay + i * itemInterval;
                const itemSpring = spring({ frame: Math.max(0, frame - itemDelay), fps, config: resolveSpring(a.item?.spring) });
                const itemOpacity = interpolate(itemSpring, [0, 1], [0, 1]);
                const itemScale = interpolate(itemSpring, [0, 1], [0.85, 1]);
                const itemColor = item.color || theme.color.accent;
                const sizeFactor = item.size || 1;
                return (
                  <div
                    key={i}
                    style={{
                      flexBasis: isRow ? `${100 * sizeFactor}px` : 'auto',
                      flexGrow: 0,
                      flexShrink: 0,
                      minWidth: isRow ? 120 : 140,
                      minHeight: isRow ? 80 : 80 * sizeFactor,
                      padding: '20px 28px',
                      background: `linear-gradient(135deg, ${itemColor}28 0%, ${itemColor}14 100%)`,
                      border: `2px solid ${itemColor}`,
                      borderRadius: 12,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 24,
                      fontWeight: 700,
                      color: theme.color.textPrimary,
                      opacity: itemOpacity,
                      transform: `scale(${itemScale})`,
                      boxShadow: theme.elevation.subtle,
                      fontFamily: theme.font.base,
                    }}
                  >
                    {item.label}
                  </div>
                );
              })}
            </div>

            {/* Cross axis label (right for column) */}
            {!isRow && (
              <div style={{ writingMode: 'vertical-rl' as const, fontSize: 16, fontWeight: 700, color: theme.color.accentSecondary, letterSpacing: '0.06em', textTransform: 'uppercase' as const, fontFamily: theme.font.numeric }}>
                {crossAxis}
              </div>
            )}
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
          {caption && <p style={{ ...captionSpec, color: theme.color.textMuted, margin: 0 }}>{caption}</p>}
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
