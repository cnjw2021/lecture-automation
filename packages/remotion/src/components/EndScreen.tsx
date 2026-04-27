import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';
import { theme } from '../theme';
import { getAnimConfig, resolveSpring } from '../animation';
import type { ElementAnim } from '../animation';

interface EndScreenProps {
  title?: string;
  message?: string;
  nextPreview?: string;
  credits?: string[];
  animation?: Record<string, Partial<ElementAnim>>;
}

interface EndScreenAnim {
  title: ElementAnim;
  message: ElementAnim;
  credits: ElementAnim;
}

export const EndScreen: React.FC<EndScreenProps> = ({
  title = 'お疲れ様でした',
  message,
  nextPreview,
  credits,
  animation,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const a = getAnimConfig<EndScreenAnim>('EndScreen', animation);

  const titleSpring = spring({ frame, fps, config: resolveSpring(a.title?.spring) });
  const titleOpacity = interpolate(titleSpring, [0, 1], [0, 1]);
  const titleScale = interpolate(titleSpring, [0, 1], [0.9, 1]);

  const msgDelay = a.message?.delay ?? 18;
  const msgSpring = spring({ frame: Math.max(0, frame - msgDelay), fps, config: resolveSpring(a.message?.spring) });
  const msgOpacity = interpolate(msgSpring, [0, 1], [0, 1]);

  const credDelay = a.credits?.delay ?? 35;

  const lineWidth = interpolate(frame, [10, 35], [0, 200], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ background: theme.bg.title, justifyContent: 'center', alignItems: 'center' }}>
      {/* Glow */}
      <div style={{ position: 'absolute', width: 600, height: 600, borderRadius: '50%', background: theme.glow.title, top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }} />

      <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', padding: '0 140px' }}>
        {/* Title */}
        <h1
          style={{
            fontSize: 80,
            fontWeight: 800,
            color: theme.color.textPrimary,
            opacity: titleOpacity,
            transform: `scale(${titleScale})`,
            marginBottom: 24,
          }}
        >
          {title}
        </h1>

        {/* Line */}
        <div style={{ width: lineWidth, height: 3, background: theme.color.gradientLine, margin: '0 auto 32px', borderRadius: 2 }} />

        {/* Message */}
        {message && (
          <p style={{ fontSize: 38, fontWeight: 400, color: theme.color.textSecondary, opacity: msgOpacity, lineHeight: 1.6, marginBottom: 32 }}>
            {message}
          </p>
        )}

        {/* Next preview */}
        {nextPreview && (
          <div
            style={{
              display: 'inline-block',
              padding: '20px 48px',
              borderRadius: 40,
              border: `2px solid ${theme.color.surfaceBorder}`,
              background: theme.color.surface,
              opacity: msgOpacity,
              marginBottom: 36,
              boxShadow: theme.elevation.subtle,
            }}
          >
            <span style={{ fontSize: 28, color: theme.color.textMuted, marginRight: 18 }}>次回</span>
            <span style={{ fontSize: 36, fontWeight: 700, color: theme.color.textPrimary }}>{nextPreview}</span>
          </div>
        )}

        {/* Credits */}
        {credits && credits.length > 0 && (
          <div style={{ marginTop: 20 }}>
            {credits.map((credit, i) => {
              const cSpring = spring({ frame: Math.max(0, frame - (credDelay + i * 8)), fps, config: resolveSpring(a.credits?.spring) });
              return (
                <p key={i} style={{ fontSize: 22, color: theme.color.textMuted, opacity: interpolate(cSpring, [0, 1], [0, 1]), marginBottom: 8 }}>
                  {credit}
                </p>
              );
            })}
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};
