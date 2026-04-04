import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';
import { theme } from '../theme';
import { getAnimConfig, resolveSpring } from '../animation';
import type { ElementAnim } from '../animation';

interface BarItem {
  label: string;
  value: number;
  color?: string;
}

interface BarChartScreenProps {
  title?: string;
  bars: BarItem[];
  unit?: string;
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

  const defaultColors = ['#C47B5A', '#7BA68C', '#6366f1', '#f59e0b', '#ef4444', '#22c55e'];

  return (
    <AbsoluteFill style={{ background: theme.bg.primary, padding: '80px 140px' }}>
      {title && (
        <h1 style={{ fontSize: 52, fontWeight: 800, color: theme.color.textPrimary, opacity: titleOpacity, marginBottom: 56, textAlign: 'center' }}>
          {title}
        </h1>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 28, flex: 1, justifyContent: 'center' }}>
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
                <span style={{ fontSize: 28, fontWeight: 600, color: theme.color.textPrimary }}>{bar.label}</span>
              </div>

              {/* Bar track */}
              <div style={{ flex: 1, height: 44, background: theme.color.surface, borderRadius: 12, overflow: 'hidden', position: 'relative' }}>
                {/* Filled bar */}
                <div
                  style={{
                    height: '100%',
                    width: `${widthPercent * barProgress}%`,
                    background: `linear-gradient(90deg, ${barColor}, ${barColor}cc)`,
                    borderRadius: 12,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    paddingRight: 16,
                    minWidth: barProgress > 0.1 ? 60 : 0,
                  }}
                >
                  {barProgress > 0.5 && (
                    <span style={{ fontSize: 20, fontWeight: 700, color: '#fff' }}>
                      {Math.round(bar.value * barProgress)}{unit}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
