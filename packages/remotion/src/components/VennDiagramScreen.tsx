import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';
import { theme } from '../theme';
import { getAnimConfig, resolveSpring } from '../animation';
import type { ElementAnim } from '../animation';

interface VennCircle {
  label: string;
  color?: string;
}

interface VennDiagramScreenProps {
  title?: string;
  left: VennCircle;
  right: VennCircle;
  intersection: string;
  animation?: Record<string, Partial<ElementAnim>>;
}

interface VennDiagramScreenAnim {
  title: ElementAnim;
  circle: ElementAnim;
  intersection: ElementAnim;
}

export const VennDiagramScreen: React.FC<VennDiagramScreenProps> = ({
  title,
  left,
  right,
  intersection,
  animation,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const a = getAnimConfig<VennDiagramScreenAnim>('VennDiagramScreen', animation);

  const titleSpring = spring({ frame, fps, config: resolveSpring(a.title?.spring) });
  const titleOpacity = interpolate(titleSpring, [0, 1], [0, 1]);

  const circleDelay = a.circle?.delay ?? 8;
  const circleSpring = spring({ frame: Math.max(0, frame - circleDelay), fps, config: resolveSpring(a.circle?.spring) });
  const circleScale = interpolate(circleSpring, [0, 1], [0, 1]);

  const intDelay = a.intersection?.delay ?? 25;
  const intSpring = spring({ frame: Math.max(0, frame - intDelay), fps, config: resolveSpring(a.intersection?.spring) });
  const intOpacity = interpolate(intSpring, [0, 1], [0, 1]);
  const intScale = interpolate(intSpring, [0, 1], [0.8, 1]);

  const leftColor = left.color || theme.color.accent;
  const rightColor = right.color || theme.color.accentSecondary;
  const r = 220;
  const overlap = 80;

  return (
    <AbsoluteFill style={{ background: theme.bg.primary, justifyContent: 'center', alignItems: 'center' }}>
      {title && (
        <h1 style={{ position: 'absolute', top: 60, left: 0, right: 0, textAlign: 'center', fontSize: 52, fontWeight: 800, color: theme.color.textPrimary, opacity: titleOpacity }}>
          {title}
        </h1>
      )}

      <div style={{ position: 'relative', width: r * 2 * 2 - overlap, height: r * 2 + 100 }}>
        {/* Left circle */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: r * 2,
            height: r * 2,
            borderRadius: '50%',
            background: `${leftColor}18`,
            border: `3px solid ${leftColor}40`,
            transform: `scale(${circleScale})`,
            display: 'flex',
            alignItems: 'center',
            paddingLeft: 60,
          }}
        >
          <span style={{ fontSize: 32, fontWeight: 700, color: leftColor, maxWidth: 160, textAlign: 'center' }}>
            {left.label}
          </span>
        </div>

        {/* Right circle */}
        <div
          style={{
            position: 'absolute',
            right: 0,
            top: 0,
            width: r * 2,
            height: r * 2,
            borderRadius: '50%',
            background: `${rightColor}18`,
            border: `3px solid ${rightColor}40`,
            transform: `scale(${circleScale})`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            paddingRight: 60,
          }}
        >
          <span style={{ fontSize: 32, fontWeight: 700, color: rightColor, maxWidth: 160, textAlign: 'center' }}>
            {right.label}
          </span>
        </div>

        {/* Intersection label */}
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            transform: `translate(-50%, -50%) scale(${intScale})`,
            opacity: intOpacity,
            textAlign: 'center',
            maxWidth: overlap + 80,
          }}
        >
          <div
            style={{
              padding: '16px 28px',
              borderRadius: 16,
              background: theme.color.nodeBackground,
              boxShadow: theme.color.nodeShadow,
              border: `1px solid ${theme.color.surfaceBorder}`,
            }}
          >
            <span style={{ fontSize: 28, fontWeight: 700, color: theme.color.textPrimary }}>
              {intersection}
            </span>
          </div>
        </div>

        {/* Bottom labels below circles */}
      </div>
    </AbsoluteFill>
  );
};
