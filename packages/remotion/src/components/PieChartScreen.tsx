import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';
import { theme, typographyStyle } from '../theme';
import { getAnimConfig, resolveSpring } from '../animation';
import type { ElementAnim } from '../animation';
import { SectionEyebrow, MetricBadge, DecorativeBackdrop } from './shared';
import type { BackdropVariant } from './shared';

interface PieSlice {
  label: string;
  value: number;
  color?: string;
}

interface PieChartScreenProps {
  title?: string;
  slices: PieSlice[];
  eyebrow?: string;
  badge?: string;
  metric?: string;
  caption?: string;
  backdropVariant?: BackdropVariant;
  subtitle?: string;
  footnote?: string;
  animation?: Record<string, Partial<ElementAnim>>;
}

interface PieChartScreenAnim {
  title: ElementAnim;
  chart: ElementAnim;
  legend: ElementAnim;
}

export const PieChartScreen: React.FC<PieChartScreenProps> = ({
  title,
  slices,
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
  const a = getAnimConfig<PieChartScreenAnim>('PieChartScreen', animation);

  const titleSpring = spring({ frame, fps, config: resolveSpring(a.title?.spring) });
  const titleOpacity = interpolate(titleSpring, [0, 1], [0, 1]);

  const chartDelay = a.chart?.delay ?? 10;
  const chartSpring = spring({
    frame: Math.max(0, frame - chartDelay),
    fps,
    config: resolveSpring(a.chart?.spring),
  });
  const chartScale = interpolate(chartSpring, [0, 1], [0.8, 1]);
  const chartOpacity = interpolate(chartSpring, [0, 1], [0, 1]);

  const drawProgress = interpolate(frame, [chartDelay, chartDelay + 40], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const total = slices.reduce((s, sl) => s + sl.value, 0);
  const defaultColors = [
    theme.color.accent,
    theme.color.accentSecondary,
    '#6366f1',
    theme.infographic.warning,
    theme.infographic.danger,
    theme.infographic.success,
    '#8b5cf6',
    '#ec4899',
  ];

  const cx = 200;
  const cy = 200;
  const r = 158;
  const innerR = 88;

  const legendDelay = a.legend?.delay ?? 30;

  let cumAngle = -90;
  const segments = slices.map((slice, i) => {
    const angle = (slice.value / total) * 360;
    const startAngle = cumAngle;
    cumAngle += angle;
    return {
      ...slice,
      startAngle,
      angle,
      color: slice.color || defaultColors[i % defaultColors.length],
    };
  });

  const describeArc = (
    startAngle: number,
    endAngle: number,
    outerR: number,
    inner: number,
  ) => {
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const x1 = cx + outerR * Math.cos(toRad(startAngle));
    const y1 = cy + outerR * Math.sin(toRad(startAngle));
    const x2 = cx + outerR * Math.cos(toRad(endAngle));
    const y2 = cy + outerR * Math.sin(toRad(endAngle));
    const x3 = cx + inner * Math.cos(toRad(endAngle));
    const y3 = cy + inner * Math.sin(toRad(endAngle));
    const x4 = cx + inner * Math.cos(toRad(startAngle));
    const y4 = cy + inner * Math.sin(toRad(startAngle));
    const largeArc = endAngle - startAngle > 180 ? 1 : 0;
    return `M ${x1} ${y1} A ${outerR} ${outerR} 0 ${largeArc} 1 ${x2} ${y2} L ${x3} ${y3} A ${inner} ${inner} 0 ${largeArc} 0 ${x4} ${y4} Z`;
  };

  const headlineSpec = typographyStyle('headline');
  const captionSpec = typographyStyle('caption');
  const hasHeader = !!(eyebrow || title || badge || metric || subtitle);

  return (
    <AbsoluteFill
      style={{ background: theme.bg.primary, padding: '70px 100px', overflow: 'hidden' }}
    >
      {backdropVariant && (
        <DecorativeBackdrop variant={backdropVariant} color={theme.color.accent} opacity={0.05} />
      )}

      {/* Header */}
      {hasHeader && (
        <div
          style={{
            marginBottom: 28,
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
        <h1 style={{ ...headlineSpec, color: theme.color.textPrimary, opacity: titleOpacity, textAlign: 'center', marginBottom: 32 }}>
          {title}
        </h1>
      )}

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 80,
          flex: 1,
        }}
      >
        {/* Donut chart */}
        <div style={{ opacity: chartOpacity, transform: `scale(${chartScale})` }}>
          <svg width={400} height={400} viewBox="0 0 400 400">
            {/* Track ring */}
            <circle
              cx={cx}
              cy={cy}
              r={(r + innerR) / 2}
              fill="none"
              stroke={theme.infographic.panelBorderStrong}
              strokeWidth={r - innerR}
              opacity={0.4}
            />
            {segments.map((seg, i) => {
              const drawnAngle = seg.angle * drawProgress;
              if (drawnAngle < 0.5) return null;
              const endAngle = seg.startAngle + drawnAngle;
              return (
                <path
                  key={i}
                  d={describeArc(seg.startAngle, endAngle, r, innerR)}
                  fill={seg.color}
                  opacity={0.9}
                />
              );
            })}

            {/* Center */}
            <circle cx={cx} cy={cy} r={innerR - 3} fill={theme.infographic.panelBg} />
            <text
              x={cx}
              y={cy - 10}
              textAnchor="middle"
              fontSize={38}
              fontWeight={800}
              fill={theme.color.textPrimary}
              fontFamily="Inter, sans-serif"
            >
              {total}
            </text>
            <text
              x={cx}
              y={cy + 18}
              textAnchor="middle"
              fontSize={15}
              fill={theme.color.textMuted}
              fontFamily="Inter, sans-serif"
              letterSpacing="0.06em"
            >
              TOTAL
            </text>
          </svg>
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {segments.map((seg, i) => {
            const legDelay = legendDelay + i * 8;
            const legSpring = spring({
              frame: Math.max(0, frame - legDelay),
              fps,
              config: resolveSpring(a.legend?.spring),
            });
            const legOpacity = interpolate(legSpring, [0, 1], [0, 1]);
            const legX = interpolate(legSpring, [0, 1], [30, 0]);
            const pct = Math.round((seg.value / total) * 100);

            return (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 16,
                  opacity: legOpacity,
                  transform: `translateX(${legX}px)`,
                }}
              >
                <div
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: 5,
                    background: seg.color,
                    flexShrink: 0,
                    boxShadow: theme.elevation.subtle,
                  }}
                />
                <span
                  style={{
                    fontSize: 26,
                    fontWeight: 700,
                    color: seg.color,
                    minWidth: 64,
                    fontFamily: 'Inter, sans-serif',
                  }}
                >
                  {pct}%
                </span>
                <span style={{ fontSize: 26, color: theme.color.textSecondary }}>{seg.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Caption / Footnote */}
      {(caption || footnote) && (
        <div
          style={{
            marginTop: 20,
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
