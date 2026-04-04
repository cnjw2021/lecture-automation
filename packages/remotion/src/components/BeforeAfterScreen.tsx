import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';
import { theme } from '../theme';
import { getAnimConfig, resolveSpring } from '../animation';
import type { ElementAnim } from '../animation';

interface BeforeAfterScreenProps {
  title?: string;
  before: { label: string; points: string[]; color?: string };
  after: { label: string; points: string[]; color?: string };
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
  animation,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const a = getAnimConfig<BeforeAfterScreenAnim>('BeforeAfterScreen', animation);

  const titleSpring = spring({ frame, fps, config: resolveSpring(a.title?.spring) });
  const titleOpacity = interpolate(titleSpring, [0, 1], [0, 1]);

  const beforeDelay = a.before?.delay ?? 8;
  const beforeSpring = spring({
    frame: Math.max(0, frame - beforeDelay),
    fps,
    config: resolveSpring(a.before?.spring),
  });
  const beforeOpacity = interpolate(beforeSpring, [0, 1], [0, 1]);
  const beforeY = interpolate(beforeSpring, [0, 1], [-30, 0]);

  const arrowDelay = a.arrow?.delay ?? 20;
  const arrowSpring = spring({
    frame: Math.max(0, frame - arrowDelay),
    fps,
    config: resolveSpring(a.arrow?.spring),
  });
  const arrowScale = interpolate(arrowSpring, [0, 1], [0, 1]);

  const afterDelay = a.after?.delay ?? 28;
  const afterSpring = spring({
    frame: Math.max(0, frame - afterDelay),
    fps,
    config: resolveSpring(a.after?.spring),
  });
  const afterOpacity = interpolate(afterSpring, [0, 1], [0, 1]);
  const afterY = interpolate(afterSpring, [0, 1], [30, 0]);

  const beforeColor = before.color || '#ef4444';
  const afterColor = after.color || '#22c55e';

  const renderSection = (
    data: { label: string; points: string[] },
    color: string,
    opacity: number,
    translateY: number,
  ) => (
    <div
      style={{
        flex: 1,
        padding: '28px 40px',
        background: theme.color.surface,
        borderRadius: 16,
        borderLeft: `4px solid ${color}`,
        opacity,
        transform: `translateY(${translateY}px)`,
      }}
    >
      <h3 style={{ fontSize: 32, fontWeight: 700, color, marginBottom: 20 }}>{data.label}</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {data.points.map((pt, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, marginTop: 12, opacity: 0.6, flexShrink: 0 }} />
            <span style={{ fontSize: 28, color: theme.color.textPrimary, lineHeight: 1.5 }}>{pt}</span>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <AbsoluteFill style={{ background: theme.bg.primary, padding: '70px 140px', justifyContent: 'center' }}>
      {title && (
        <h1 style={{ fontSize: 52, fontWeight: 800, color: theme.color.textPrimary, opacity: titleOpacity, marginBottom: 40, textAlign: 'center' }}>
          {title}
        </h1>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 0, alignItems: 'stretch' }}>
        {renderSection(before, beforeColor, beforeOpacity, beforeY)}

        {/* Arrow */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0', transform: `scale(${arrowScale})` }}>
          <div style={{ fontSize: 36, color: theme.color.accent, opacity: 0.6 }}>▼</div>
        </div>

        {renderSection(after, afterColor, afterOpacity, afterY)}
      </div>
    </AbsoluteFill>
  );
};
