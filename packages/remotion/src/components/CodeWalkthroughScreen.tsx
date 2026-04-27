import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';
import { theme } from '../theme';
import { getAnimConfig, resolveSpring } from '../animation';
import type { ElementAnim } from '../animation';

interface CodeWalkthroughScreenProps {
  title?: string;
  code: string;
  language?: string;
  highlightLines?: number[];
  caption?: string;
  animation?: Record<string, Partial<ElementAnim>>;
}

interface CodeWalkthroughScreenAnim {
  title: ElementAnim;
  code: ElementAnim;
  highlight: ElementAnim;
}

export const CodeWalkthroughScreen: React.FC<CodeWalkthroughScreenProps> = ({
  title,
  code,
  highlightLines = [],
  caption,
  animation,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const a = getAnimConfig<CodeWalkthroughScreenAnim>('CodeWalkthroughScreen', animation);

  const titleSpring = spring({ frame, fps, config: resolveSpring(a.title?.spring) });
  const titleOpacity = interpolate(titleSpring, [0, 1], [0, 1]);

  const codeDelay = a.code?.delay ?? 10;
  const codeSpring = spring({
    frame: Math.max(0, frame - codeDelay),
    fps,
    config: resolveSpring(a.code?.spring),
  });
  const codeOpacity = interpolate(codeSpring, [0, 1], [0, 1]);
  const codeY = interpolate(codeSpring, [0, 1], [30, 0]);

  const lines = code.split('\n');
  const hlDelay = a.highlight?.delay ?? 25;
  const hlProgress = interpolate(frame, [hlDelay, hlDelay + 15], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{ background: theme.bg.primary, padding: '70px 120px', display: 'flex', flexDirection: 'column' }}>
      {title && (
        <h1
          style={{
            fontSize: 48,
            fontWeight: 800,
            color: theme.color.textPrimary,
            opacity: titleOpacity,
            marginBottom: 36,
          }}
        >
          {title}
        </h1>
      )}

      <div
        style={{
          flex: 1,
          background: theme.bg.code,
          borderRadius: 20,
          border: `1px solid ${theme.color.divider}`,
          boxShadow: theme.color.nodeShadow,
          padding: '48px 56px',
          opacity: codeOpacity,
          transform: `translateY(${codeY}px)`,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
        }}
      >
        {/* Language badge */}
        <div
          style={{
            position: 'absolute',
            top: title ? 122 : 86,
            right: 140,
            fontSize: 14,
            fontWeight: 600,
            color: theme.color.accent,
            opacity: 0.5,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
          }}
        >
        </div>

        {/* Code lines */}
        <div style={{ fontFamily: "'SF Mono', 'Fira Code', 'Consolas', monospace" }}>
          {lines.map((line, i) => {
            const lineNum = i + 1;
            const isHighlighted = highlightLines.includes(lineNum);

            return (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '4px 12px',
                  marginLeft: -12,
                  marginRight: -12,
                  borderRadius: 8,
                  background: isHighlighted
                    ? `${theme.color.accent}${Math.round(hlProgress * 20).toString(16).padStart(2, '0')}`
                    : 'transparent',
                  borderLeft: isHighlighted
                    ? `3px solid ${theme.color.accent}`
                    : '3px solid transparent',
                  transition: 'background 0.3s',
                }}
              >
                <span
                  style={{
                    width: 56,
                    fontSize: 24,
                    color: theme.color.textMuted,
                    textAlign: 'right',
                    marginRight: 28,
                    fontVariantNumeric: 'tabular-nums',
                    userSelect: 'none',
                  }}
                >
                  {lineNum}
                </span>
                <span
                  style={{
                    fontSize: 30,
                    color: isHighlighted ? theme.color.textPrimary : theme.color.textSecondary,
                    fontWeight: isHighlighted ? 600 : 400,
                    whiteSpace: 'pre',
                    lineHeight: 1.7,
                  }}
                >
                  {line || ' '}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {caption && (
        <p
          style={{
            fontSize: 24,
            color: theme.color.textSecondary,
            marginTop: 20,
            textAlign: 'center',
            opacity: codeOpacity,
          }}
        >
          {caption}
        </p>
      )}
    </AbsoluteFill>
  );
};
