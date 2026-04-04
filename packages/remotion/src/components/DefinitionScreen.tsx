import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';
import { theme } from '../theme';
import { getAnimConfig, resolveSpring } from '../animation';
import type { ElementAnim } from '../animation';

interface DefinitionScreenProps {
  term: string;
  reading?: string;
  definition: string;
  example?: string;
  color?: string;
  animation?: Record<string, Partial<ElementAnim>>;
}

interface DefinitionScreenAnim {
  term: ElementAnim;
  definition: ElementAnim;
  example: ElementAnim;
}

export const DefinitionScreen: React.FC<DefinitionScreenProps> = ({
  term,
  reading,
  definition,
  example,
  color,
  animation,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const a = getAnimConfig<DefinitionScreenAnim>('DefinitionScreen', animation);

  const accentColor = color || theme.color.accent;

  const termSpring = spring({ frame, fps, config: resolveSpring(a.term?.spring) });
  const termOpacity = interpolate(termSpring, [0, 1], [0, 1]);
  const termScale = interpolate(termSpring, [0, 1], [0.9, 1]);

  const defDelay = a.definition?.delay ?? 15;
  const defSpring = spring({ frame: Math.max(0, frame - defDelay), fps, config: resolveSpring(a.definition?.spring) });
  const defOpacity = interpolate(defSpring, [0, 1], [0, 1]);
  const defY = interpolate(defSpring, [0, 1], [30, 0]);

  const exDelay = a.example?.delay ?? 30;
  const exSpring = spring({ frame: Math.max(0, frame - exDelay), fps, config: resolveSpring(a.example?.spring) });
  const exOpacity = interpolate(exSpring, [0, 1], [0, 1]);

  const lineWidth = interpolate(frame, [8, 35], [0, 160], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ background: theme.bg.primary, justifyContent: 'center', alignItems: 'center' }}>
      {/* Background decorative bracket */}
      <div style={{ position: 'absolute', top: '18%', left: '8%', fontSize: 320, fontFamily: 'Georgia, serif', color: accentColor, opacity: 0.06, lineHeight: 1 }}>
        {'{'}
      </div>
      <div style={{ position: 'absolute', bottom: '18%', right: '8%', fontSize: 320, fontFamily: 'Georgia, serif', color: accentColor, opacity: 0.06, lineHeight: 1 }}>
        {'}'}
      </div>

      <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', maxWidth: 1400, padding: '0 140px' }}>
        {/* Reading (furigana-like) */}
        {reading && (
          <p style={{ fontSize: 24, color: theme.color.textMuted, opacity: termOpacity, marginBottom: 8, letterSpacing: '0.3em' }}>
            {reading}
          </p>
        )}

        {/* Term */}
        <h1
          style={{
            fontSize: 96,
            fontWeight: 900,
            color: accentColor,
            opacity: termOpacity,
            transform: `scale(${termScale})`,
            marginBottom: 16,
            letterSpacing: '0.02em',
          }}
        >
          {term}
        </h1>

        {/* Divider */}
        <div style={{ width: lineWidth, height: 3, background: accentColor, margin: '0 auto 32px', borderRadius: 2, opacity: 0.5 }} />

        {/* Definition */}
        <p
          style={{
            fontSize: 40,
            fontWeight: 500,
            color: theme.color.textPrimary,
            lineHeight: 1.7,
            opacity: defOpacity,
            transform: `translateY(${defY}px)`,
            marginBottom: example ? 36 : 0,
          }}
        >
          {definition}
        </p>

        {/* Example */}
        {example && (
          <div
            style={{
              display: 'inline-block',
              padding: '16px 32px',
              background: theme.color.surface,
              borderRadius: 12,
              border: `1px solid ${theme.color.surfaceBorder}`,
              opacity: exOpacity,
            }}
          >
            <span style={{ fontSize: 18, fontWeight: 600, color: theme.color.accent, marginRight: 12 }}>例</span>
            <span style={{ fontSize: 28, color: theme.color.textSecondary }}>{example}</span>
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};
