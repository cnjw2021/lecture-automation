import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';
import { theme } from '../theme';
import { getAnimConfig, resolveSpring, type QuoteScreenAnim } from '../animation';

interface QuoteScreenProps {
  quote: string;
  attribution?: string;
  animation?: Partial<Record<keyof QuoteScreenAnim, Record<string, unknown>>>;
}

export const QuoteScreen: React.FC<QuoteScreenProps> = ({ quote, attribution, animation }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const a = getAnimConfig<QuoteScreenAnim>('QuoteScreen', animation);

  // Opening quote mark scale-in
  const quoteMarkSpring = spring({
    frame,
    fps,
    config: resolveSpring(a.quoteMark.spring),
  });
  const qmScale = a.quoteMark.scale ?? [0.3, 1];
  const qmOpacity = a.quoteMark.opacity ?? [0, 0.15];
  const quoteMarkScale = interpolate(quoteMarkSpring, [0, 1], qmScale);
  const quoteMarkOpacity = interpolate(quoteMarkSpring, [0, 1], qmOpacity);

  // Quote text fade-in with slide
  const textSpring = spring({
    frame: Math.max(0, frame - (a.text.delay ?? 10)),
    fps,
    config: resolveSpring(a.text.spring),
  });
  const textOpacity = interpolate(textSpring, [0, 1], [0, 1]);
  const textY = interpolate(textSpring, [0, 1], [a.text.distance?.y ?? 40, 0]);

  // Attribution fade-in
  const attrSpring = spring({
    frame: Math.max(0, frame - (a.attribution.delay ?? 25)),
    fps,
    config: resolveSpring(a.attribution.spring),
  });
  const attrOpacity = interpolate(attrSpring, [0, 1], [0, 1]);

  // Decorative line animation
  const lineWidth = interpolate(frame, a.line.frames, [0, a.line.width], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{
        background: theme.bg.primary,
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      {/* Large decorative quote mark */}
      <div
        style={{
          position: 'absolute',
          top: '22%',
          left: '12%',
          fontSize: 400,
          fontFamily: 'Georgia, serif',
          color: theme.color.accent,
          opacity: quoteMarkOpacity,
          transform: `scale(${quoteMarkScale})`,
          lineHeight: 1,
          userSelect: 'none',
        }}
      >
        {'\u201C'}
      </div>

      <div
        style={{
          position: 'relative',
          zIndex: 1,
          maxWidth: 1400,
          padding: '0 160px',
          textAlign: 'center',
        }}
      >
        {/* Quote text */}
        <p
          style={{
            fontSize: 56,
            fontWeight: 500,
            color: theme.color.textPrimary,
            lineHeight: 1.6,
            fontStyle: 'italic',
            opacity: textOpacity,
            transform: `translateY(${textY}px)`,
            marginBottom: 40,
          }}
        >
          {quote}
        </p>

        {/* Decorative line */}
        <div
          style={{
            width: lineWidth,
            height: 3,
            background: theme.color.gradientLine,
            margin: '0 auto 28px',
            borderRadius: 2,
          }}
        />

        {/* Attribution */}
        {attribution && (
          <p
            style={{
              fontSize: 32,
              fontWeight: 400,
              color: theme.color.accent,
              opacity: attrOpacity,
            }}
          >
            {'\u2014'} {attribution}
          </p>
        )}
      </div>
    </AbsoluteFill>
  );
};
