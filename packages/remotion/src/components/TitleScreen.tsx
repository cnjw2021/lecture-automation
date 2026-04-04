import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';
import { theme } from '../theme';
import { getAnimConfig, resolveSpring, type TitleScreenAnim } from '../animation';

interface TitleScreenProps {
  title?: string;
  main?: string;
  sub?: string;
  animation?: Partial<Record<keyof TitleScreenAnim, Record<string, unknown>>>;
}

export const TitleScreen: React.FC<TitleScreenProps> = ({ title, main, sub, animation }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const a = getAnimConfig<TitleScreenAnim>('TitleScreen', animation);

  // Background fade-in
  const bgOpacity = interpolate(frame, a.bg.fadeFrames, [0, 1], {
    extrapolateRight: 'clamp',
  });

  // Title spring animation (slide up + fade in)
  const titleSpring = spring({
    frame,
    fps,
    config: resolveSpring(a.title.spring),
  });
  const titleY = interpolate(titleSpring, [0, 1], [a.title.distance?.y ?? 60, 0]);
  const titleOpacity = interpolate(titleSpring, [0, 1], [0, 1]);

  // Subtitle delayed fade-in
  const subDelay = a.sub.delay ?? 18;
  const subSpring = spring({
    frame: Math.max(0, frame - subDelay),
    fps,
    config: resolveSpring(a.sub.spring),
  });
  const subOpacity = interpolate(subSpring, [0, 1], [0, 1]);
  const subY = interpolate(subSpring, [0, 1], [a.sub.distance?.y ?? 30, 0]);

  // Decorative line animation
  const lineWidth = interpolate(frame, a.line.frames, [0, a.line.width], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const displayTitle = title || main || 'Untitled Scene';

  return (
    <AbsoluteFill
      style={{
        background: theme.bg.title,
        justifyContent: 'center',
        alignItems: 'center',
        textAlign: 'center',
        opacity: bgOpacity,
      }}
    >
      {/* Subtle glow behind title */}
      <div
        style={{
          position: 'absolute',
          width: 600,
          height: 600,
          borderRadius: '50%',
          background: theme.glow.title,
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
        }}
      />

      <div style={{ position: 'relative', zIndex: 1, padding: '0 120px' }}>
        <h1
          style={{
            fontSize: 90,
            fontWeight: 800,
            color: theme.color.textPrimary,
            lineHeight: 1.2,
            marginBottom: 24,
            opacity: titleOpacity,
            transform: `translateY(${titleY}px)`,
            textShadow: '0 2px 40px rgba(196,123,90,0.15)',
          }}
        >
          {displayTitle}
        </h1>

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

        {sub && (
          <h2
            style={{
              fontSize: 44,
              fontWeight: 400,
              color: theme.color.textSecondary,
              opacity: subOpacity,
              transform: `translateY(${subY}px)`,
            }}
          >
            {sub}
          </h2>
        )}
      </div>
    </AbsoluteFill>
  );
};
