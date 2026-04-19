import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';
import { theme, typographyStyle } from '../theme';
import { getAnimConfig, resolveSpring } from '../animation';
import type { ElementAnim } from '../animation';
import { SectionEyebrow, MetricBadge, InfographicPanel, DecorativeBackdrop } from './shared';
import type { BackdropVariant } from './shared';

interface BarItem {
  label: string;
  value: number;
  color?: string;
}

interface BarChartScreenProps {
  title?: string;
  bars: BarItem[];
  unit?: string;
  eyebrow?: string;
  badge?: string;
  metric?: string;
  caption?: string;
  backdropVariant?: BackdropVariant;
  subtitle?: string;
  footnote?: string;
  animation?: Record<string, Partial<ElementAnim>>;
}

interface BarChartScreenAnim {
  title: ElementAnim;
  bar: ElementAnim;
}

export const BarChartScreen: React.FC<BarChartScreenProps> = ({
  title,
  bars,
  unit = '',
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
  const a = getAnimConfig<BarChartScreenAnim>('BarChartScreen', animation);

  const titleSpring = spring({ frame, fps, config: resolveSpring(a.title?.spring) });
  const titleOpacity = interpolate(titleSpring, [0, 1], [0, 1]);

  const maxVal = Math.max(...bars.map((b) => b.value), 1);
  const baseDelay = (a.bar?.baseDelay as number) ?? 12;
  const interval = a.bar?.staggerInterval ?? 12;

  const defaultColors = [
    theme.color.accent,
    theme.color.accentSecondary,
    '#6366f1',
    theme.infographic.warning,
    theme.infographic.danger,
    theme.infographic.success,
  ];

  const headlineSpec = typographyStyle('headline');
  const captionSpec = typographyStyle('caption');
  const hasHeader = !!(eyebrow || title || badge || metric || subtitle);

  return (
    <AbsoluteFill
      style={{ background: theme.bg.primary, padding: `${hasHeader ? 70 : 80}px 140px 70px`, overflow: 'hidden' }}
    >
      {backdropVariant && (
        <DecorativeBackdrop variant={backdropVariant} color={theme.color.accent} opacity={0.05} />
      )}

      {/* Header */}
      {hasHeader && (
        <div
          style={{
            marginBottom: 40,
            textAlign: 'center',
            opacity: titleOpacity,
          }}
        >
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

      {/* Fallback title */}
      {!hasHeader && title && (
        <h1 style={{ ...headlineSpec, color: theme.color.textPrimary, opacity: titleOpacity, marginBottom: 40, textAlign: 'center' }}>
          {title}
        </h1>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 22, flex: 1, justifyContent: 'center' }}>
        {bars.map((bar, i) => {
          const barDelay = baseDelay + i * interval;
          const barSpring = spring({
            frame: Math.max(0, frame - barDelay),
            fps,
            config: resolveSpring(a.bar?.spring),
          });
          const barProgress = interpolate(barSpring, [0, 1], [0, 1]);
          const barOpacity = interpolate(barSpring, [0, 1], [0, 1]);
          const barColor = bar.color || defaultColors[i % defaultColors.length];
          const widthPercent = (bar.value / maxVal) * 100;

          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 20, opacity: barOpacity }}>
              {/* Label */}
              <div style={{ width: 200, textAlign: 'right', flexShrink: 0 }}>
                <span
                  style={{ fontSize: 26, fontWeight: 600, color: theme.color.textPrimary }}
                >
                  {bar.label}
                </span>
              </div>

              {/* Bar track */}
              <div
                style={{
                  flex: 1,
                  height: 46,
                  background: theme.infographic.panelBg,
                  border: `1px solid ${theme.infographic.panelBorder}`,
                  borderRadius: theme.radius.card,
                  overflow: 'hidden',
                  position: 'relative',
                  boxShadow: theme.elevation.subtle,
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${widthPercent * barProgress}%`,
                    background: `linear-gradient(90deg, ${barColor}cc, ${barColor})`,
                    borderRadius: theme.radius.card,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    paddingRight: 16,
                    minWidth: barProgress > 0.1 ? 60 : 0,
                  }}
                >
                  {barProgress > 0.5 && (
                    <span
                      style={{
                        fontSize: 19,
                        fontWeight: 700,
                        color: '#fff',
                        fontFamily: 'Inter, sans-serif',
                        letterSpacing: '-0.01em',
                      }}
                    >
                      {Math.round(bar.value * barProgress)}
                      {unit}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Caption / Footnote */}
      {(caption || footnote) && (
        <div
          style={{
            marginTop: 24,
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
