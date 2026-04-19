import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';
import { theme } from '../theme';
import { NodeIcon } from './NodeIcon';
import { getAnimConfig, resolveSpring } from '../animation';
import type { ElementAnim } from '../animation';

type CalloutType = 'tip' | 'warning' | 'info' | 'error';

interface CalloutScreenProps {
  type?: CalloutType;
  title: string;
  body: string;
  icon?: string;
  animation?: Record<string, Partial<ElementAnim>>;
}

interface CalloutScreenAnim {
  card: ElementAnim;
  text: ElementAnim;
}

const CALLOUT_STYLES: Record<CalloutType, { color: string; defaultIcon: string; label: string }> = {
  tip: { color: '#22c55e', defaultIcon: '💡', label: 'TIP' },
  warning: { color: '#f59e0b', defaultIcon: '⚠️', label: 'WARNING' },
  info: { color: '#3b82f6', defaultIcon: 'ℹ️', label: 'INFO' },
  error: { color: '#ef4444', defaultIcon: '🚫', label: 'ERROR' },
};

export const CalloutScreen: React.FC<CalloutScreenProps> = ({
  type = 'tip',
  title,
  body,
  icon,
  animation,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const a = getAnimConfig<CalloutScreenAnim>('CalloutScreen', animation);

  const style = CALLOUT_STYLES[type];
  const displayIcon = icon || style.defaultIcon;

  const cardSpring = spring({ frame, fps, config: resolveSpring(a.card?.spring) });
  const cardOpacity = interpolate(cardSpring, [0, 1], [0, 1]);
  const cardScale = interpolate(cardSpring, [0, 1], [0.92, 1]);

  const txtDelay = a.text?.delay ?? 12;
  const txtSpring = spring({ frame: Math.max(0, frame - txtDelay), fps, config: resolveSpring(a.text?.spring) });
  const txtOpacity = interpolate(txtSpring, [0, 1], [0, 1]);

  return (
    <AbsoluteFill style={{ background: theme.bg.primary, justifyContent: 'center', alignItems: 'center', padding: '0 160px' }}>
      {/* Background glow */}
      <div style={{ position: 'absolute', width: 800, height: 400, borderRadius: '50%', background: `radial-gradient(ellipse, ${style.color}08 0%, transparent 70%)` }} />

      <div
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: 1200,
          padding: '52px 60px',
          borderRadius: 24,
          background: theme.color.nodeBackground,
          boxShadow: theme.color.nodeShadow,
          borderLeft: `6px solid ${style.color}`,
          opacity: cardOpacity,
          transform: `scale(${cardScale})`,
        }}
      >
        {/* Type badge */}
        <div
          style={{
            position: 'absolute',
            top: -14,
            left: 40,
            padding: '4px 16px',
            borderRadius: 20,
            background: style.color,
            fontSize: 14,
            fontWeight: 700,
            color: '#fff',
            letterSpacing: '0.1em',
          }}
        >
          {style.label}
        </div>

        <div style={{ opacity: txtOpacity }}>
          {/* Title row: icon + title aligned center */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
            <div
              style={{
                width: 72,
                height: 72,
                borderRadius: '50%',
                background: `${style.color}15`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <NodeIcon icon={displayIcon} size={40} variant="highlighted" color={style.color} />
            </div>
            <h2 style={{ fontSize: 40, fontWeight: 700, color: theme.color.textPrimary, margin: 0, lineHeight: 1.3 }}>
              {title}
            </h2>
          </div>
          <p style={{ fontSize: 30, color: theme.color.textSecondary, lineHeight: 1.7, margin: '16px 0 0', paddingLeft: 100 }}>
            {body}
          </p>
        </div>
      </div>
    </AbsoluteFill>
  );
};
