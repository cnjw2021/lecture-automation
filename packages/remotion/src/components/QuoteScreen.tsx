import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';

interface QuoteScreenProps {
  quote: string;
  attribution?: string;
}

export const QuoteScreen: React.FC<QuoteScreenProps> = ({ quote, attribution }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Opening quote mark scale-in
  const quoteMarkSpring = spring({
    frame,
    fps,
    config: { damping: 10, stiffness: 80, mass: 0.6 },
  });
  const quoteMarkScale = interpolate(quoteMarkSpring, [0, 1], [0.3, 1]);
  const quoteMarkOpacity = interpolate(quoteMarkSpring, [0, 1], [0, 0.15]);

  // Quote text fade-in with slide
  const textSpring = spring({
    frame: Math.max(0, frame - 10),
    fps,
    config: { damping: 14, stiffness: 70, mass: 0.8 },
  });
  const textOpacity = interpolate(textSpring, [0, 1], [0, 1]);
  const textY = interpolate(textSpring, [0, 1], [40, 0]);

  // Attribution fade-in
  const attrSpring = spring({
    frame: Math.max(0, frame - 25),
    fps,
    config: { damping: 16, stiffness: 60, mass: 0.6 },
  });
  const attrOpacity = interpolate(attrSpring, [0, 1], [0, 1]);

  // Decorative line animation
  const lineWidth = interpolate(frame, [15, 45], [0, 100], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{
        background: 'linear-gradient(160deg, #0f0c29 0%, #1a1a2e 50%, #16213e 100%)',
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
          color: '#6366f1',
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
            color: '#e2e8f0',
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
            background: 'linear-gradient(90deg, #6366f1, #a78bfa)',
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
              color: 'rgba(167,139,250,0.8)',
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
