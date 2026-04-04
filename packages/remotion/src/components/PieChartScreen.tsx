import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';
import { theme } from '../theme';
import { getAnimConfig, resolveSpring } from '../animation';
import type { ElementAnim } from '../animation';

interface PieSlice {
  label: string;
  value: number;
  color?: string;
}

interface PieChartScreenProps {
  title?: string;
  slices: PieSlice[];
  animation?: Record<string, Partial<ElementAnim>>;
}

interface PieChartScreenAnim {
  title: ElementAnim;
  chart: ElementAnim;
  legend: ElementAnim;
}

export const PieChartScreen: React.FC<PieChartScreenProps> = ({ title, slices, animation }) => {
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
  const defaultColors = ['#C47B5A', '#7BA68C', '#6366f1', '#f59e0b', '#ef4444', '#22c55e', '#8b5cf6', '#ec4899'];

  const cx = 200, cy = 200, r = 160, innerR = 90;

  const legendDelay = a.legend?.delay ?? 30;

  // Build pie segments
  let cumAngle = -90; // start from top
  const segments = slices.map((slice, i) => {
    const angle = (slice.value / total) * 360;
    const startAngle = cumAngle;
    cumAngle += angle;
    return { ...slice, startAngle, angle, color: slice.color || defaultColors[i % defaultColors.length] };
  });

  const describeArc = (startAngle: number, endAngle: number, outerR: number, innerRadius: number) => {
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const x1 = cx + outerR * Math.cos(toRad(startAngle));
    const y1 = cy + outerR * Math.sin(toRad(startAngle));
    const x2 = cx + outerR * Math.cos(toRad(endAngle));
    const y2 = cy + outerR * Math.sin(toRad(endAngle));
    const x3 = cx + innerRadius * Math.cos(toRad(endAngle));
    const y3 = cy + innerRadius * Math.sin(toRad(endAngle));
    const x4 = cx + innerRadius * Math.cos(toRad(startAngle));
    const y4 = cy + innerRadius * Math.sin(toRad(startAngle));
    const largeArc = endAngle - startAngle > 180 ? 1 : 0;
    return `M ${x1} ${y1} A ${outerR} ${outerR} 0 ${largeArc} 1 ${x2} ${y2} L ${x3} ${y3} A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${x4} ${y4} Z`;
  };

  return (
    <AbsoluteFill style={{ background: theme.bg.primary, padding: '70px 100px' }}>
      {title && (
        <h1 style={{ fontSize: 52, fontWeight: 800, color: theme.color.textPrimary, opacity: titleOpacity, textAlign: 'center', marginBottom: 40 }}>
          {title}
        </h1>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 80, flex: 1 }}>
        {/* Donut chart */}
        <div style={{ opacity: chartOpacity, transform: `scale(${chartScale})` }}>
          <svg width={400} height={400} viewBox="0 0 400 400">
            {segments.map((seg, i) => {
              const drawnAngle = seg.angle * drawProgress;
              if (drawnAngle < 0.5) return null;
              const endAngle = seg.startAngle + drawnAngle;
              return (
                <path
                  key={i}
                  d={describeArc(seg.startAngle, endAngle, r, innerR)}
                  fill={seg.color}
                  opacity={0.85}
                />
              );
            })}
            {/* Center circle */}
            <circle cx={cx} cy={cy} r={innerR - 2} fill={theme.bg.primary.includes('gradient') ? '#FAF6F0' : theme.bg.primary} />
            {/* Center total */}
            <text x={cx} y={cy - 8} textAnchor="middle" fontSize={36} fontWeight={800} fill={theme.color.textPrimary}>
              {total}
            </text>
            <text x={cx} y={cy + 22} textAnchor="middle" fontSize={16} fill={theme.color.textMuted}>
              TOTAL
            </text>
          </svg>
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {segments.map((seg, i) => {
            const legDelay = legendDelay + i * 8;
            const legSpring = spring({
              frame: Math.max(0, frame - legDelay),
              fps,
              config: resolveSpring(a.legend?.spring),
            });
            const legOpacity = interpolate(legSpring, [0, 1], [0, 1]);
            const pct = Math.round((seg.value / total) * 100);

            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 16, opacity: legOpacity }}>
                <div style={{ width: 18, height: 18, borderRadius: 4, background: seg.color, flexShrink: 0 }} />
                <span style={{ fontSize: 28, fontWeight: 600, color: theme.color.textPrimary, minWidth: 60 }}>{pct}%</span>
                <span style={{ fontSize: 28, color: theme.color.textSecondary }}>{seg.label}</span>
              </div>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};
