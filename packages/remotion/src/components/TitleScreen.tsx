import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';
import { theme, typographyStyle } from '../theme';
import { getAnimConfig, resolveSpring, type TitleScreenAnim } from '../animation';
import { DecorativeBackdrop, IllustrationPanel } from './shared';
import type { BackdropVariant } from './shared';

interface TitleScreenProps {
  title?: string;
  main?: string;
  sub?: string;
  illustration?: string;
  backdropVariant?: BackdropVariant;
  animation?: Partial<Record<keyof TitleScreenAnim, Record<string, unknown>>>;
}

export const TitleScreen: React.FC<TitleScreenProps> = ({
  title,
  main,
  sub,
  illustration,
  backdropVariant,
  animation,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const a = getAnimConfig<TitleScreenAnim>('TitleScreen', animation);

  const bgOpacity = interpolate(frame, a.bg.fadeFrames, [0, 1], {
    extrapolateRight: 'clamp',
  });

  const titleSpring = spring({ frame, fps, config: resolveSpring(a.title.spring) });
  const titleY = interpolate(titleSpring, [0, 1], [a.title.distance?.y ?? 60, 0]);
  const titleOpacity = interpolate(titleSpring, [0, 1], [0, 1]);

  const subDelay = a.sub.delay ?? 18;
  const subSpring = spring({
    frame: Math.max(0, frame - subDelay),
    fps,
    config: resolveSpring(a.sub.spring),
  });
  const subOpacity = interpolate(subSpring, [0, 1], [0, 1]);
  const subY = interpolate(subSpring, [0, 1], [a.sub.distance?.y ?? 30, 0]);

  const lineWidth = interpolate(frame, a.line.frames, [0, a.line.width], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const displayTitle = title || main || 'Untitled Scene';
  const titleSpec = typographyStyle('display');
  const subSpec = typographyStyle('headline');

  return (
    <AbsoluteFill
      style={{
        background: theme.bg.title,
        justifyContent: 'center',
        alignItems: 'center',
        textAlign: 'center',
        opacity: bgOpacity,
        overflow: 'hidden',
      }}
    >
      {/* Backdrop decoration */}
      {backdropVariant && (
        <DecorativeBackdrop
          variant={backdropVariant}
          color={theme.color.accent}
          opacity={0.06}
        />
      )}

      {/* Glow */}
      <div
        style={{
          position: 'absolute',
          width: 700,
          height: 700,
          borderRadius: '50%',
          background: theme.glow.title,
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
        }}
      />

      {/* Illustration (behind) */}
      {illustration && (
        <IllustrationPanel src={illustration} layout="behind" size={560} />
      )}

      <div style={{ position: 'relative', zIndex: 1, padding: '0 140px' }}>
        <h1
          style={{
            ...titleSpec,
            color: theme.color.textPrimary,
            marginBottom: 24,
            opacity: titleOpacity,
            transform: `translateY(${titleY}px)`,
            textShadow: `0 2px 40px ${theme.color.surface}`,
          }}
        >
          {displayTitle}
        </h1>

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
              ...subSpec,
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
