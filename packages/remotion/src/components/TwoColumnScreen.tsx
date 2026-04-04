import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';
import { theme } from '../theme';
import { NodeIcon } from './NodeIcon';
import { getAnimConfig, resolveSpring } from '../animation';
import type { ElementAnim } from '../animation';

interface Column {
  title: string;
  body: string;
  icon?: string;
  color?: string;
}

interface TwoColumnScreenProps {
  title?: string;
  left: Column;
  right: Column;
  animation?: Record<string, Partial<ElementAnim>>;
}

interface TwoColumnScreenAnim {
  title: ElementAnim;
  left: ElementAnim;
  right: ElementAnim;
}

export const TwoColumnScreen: React.FC<TwoColumnScreenProps> = ({ title, left, right, animation }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const a = getAnimConfig<TwoColumnScreenAnim>('TwoColumnScreen', animation);

  const titleSpring = spring({ frame, fps, config: resolveSpring(a.title?.spring) });
  const titleOpacity = interpolate(titleSpring, [0, 1], [0, 1]);

  const leftDelay = a.left?.delay ?? 8;
  const leftSpring = spring({ frame: Math.max(0, frame - leftDelay), fps, config: resolveSpring(a.left?.spring) });
  const leftOpacity = interpolate(leftSpring, [0, 1], [0, 1]);
  const leftX = interpolate(leftSpring, [0, 1], [-50, 0]);

  const rightDelay = a.right?.delay ?? 16;
  const rightSpring = spring({ frame: Math.max(0, frame - rightDelay), fps, config: resolveSpring(a.right?.spring) });
  const rightOpacity = interpolate(rightSpring, [0, 1], [0, 1]);
  const rightX = interpolate(rightSpring, [0, 1], [50, 0]);

  const renderCol = (col: Column, opacity: number, translateX: number) => {
    const colColor = col.color || theme.color.accent;
    return (
      <div
        style={{
          flex: 1,
          padding: '40px 44px',
          opacity,
          transform: `translateX(${translateX}px)`,
        }}
      >
        {col.icon && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ width: 60, height: 60, borderRadius: '50%', background: `${colColor}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <NodeIcon icon={col.icon} size={34} />
            </div>
          </div>
        )}
        <h2 style={{ fontSize: 40, fontWeight: 700, color: theme.color.textPrimary, marginBottom: 20, lineHeight: 1.3 }}>
          {col.title}
        </h2>
        <div style={{ width: 60, height: 3, background: colColor, borderRadius: 2, marginBottom: 20, opacity: 0.5 }} />
        <p style={{ fontSize: 28, color: theme.color.textSecondary, lineHeight: 1.7, margin: 0, whiteSpace: 'pre-wrap' }}>
          {col.body}
        </p>
      </div>
    );
  };

  return (
    <AbsoluteFill style={{ background: theme.bg.primary, padding: '70px 100px' }}>
      {title && (
        <h1 style={{ fontSize: 52, fontWeight: 800, color: theme.color.textPrimary, opacity: titleOpacity, textAlign: 'center', marginBottom: 40 }}>
          {title}
        </h1>
      )}

      <div style={{ display: 'flex', flex: 1, alignItems: 'center', gap: 0 }}>
        {renderCol(left, leftOpacity, leftX)}

        {/* Divider */}
        <div style={{ width: 2, height: 300, background: theme.color.divider, flexShrink: 0 }} />

        {renderCol(right, rightOpacity, rightX)}
      </div>
    </AbsoluteFill>
  );
};
