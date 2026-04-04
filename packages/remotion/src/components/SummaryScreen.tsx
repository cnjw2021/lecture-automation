import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';
import { theme } from '../theme';
import { getAnimConfig, resolveSpring, type SummaryScreenAnim } from '../animation';

interface SummaryScreenProps {
  points: string[];
  title?: string;
  animation?: Partial<Record<keyof SummaryScreenAnim, Record<string, unknown>>>;
}

export const SummaryScreen: React.FC<SummaryScreenProps> = ({ points, title, animation }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const a = getAnimConfig<SummaryScreenAnim>('SummaryScreen', animation);

  const displayTitle = title || 'Summary';

  // Title slides in from left with spring
  const titleSpring = spring({
    frame,
    fps,
    config: resolveSpring(a.title.spring),
  });
  const titleX = interpolate(titleSpring, [0, 1], [a.title.distance?.x ?? -80, 0]);
  const titleOpacity = interpolate(titleSpring, [0, 1], [0, 1]);

  return (
    <AbsoluteFill
      style={{
        background: theme.bg.primary,
        color: theme.color.textPrimary,
        padding: '100px 120px',
      }}
    >
      {/* Title */}
      <h1
        style={{
          fontSize: 72,
          fontWeight: 800,
          marginBottom: 60,
          opacity: titleOpacity,
          transform: `translateX(${titleX}px)`,
          color: theme.color.textPrimary,
        }}
      >
        {displayTitle}
      </h1>

      {/* Bullet points with staggered animation */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
        {points.map((point, i) => {
          const baseDelay = (a.item.baseDelay as number) ?? 15;
          const interval = a.item.staggerInterval ?? 20;
          const staggerDelay = baseDelay + i * interval;
          const pointSpring = spring({
            frame: Math.max(0, frame - staggerDelay),
            fps,
            config: resolveSpring(a.item.spring),
          });
          const pointOpacity = interpolate(pointSpring, [0, 1], [0, 1]);
          const pointX = interpolate(pointSpring, [0, 1], [a.item.distance?.x ?? -50, 0]);
          const itemScale = a.item.scale ?? [0.95, 1];
          const pointScale = interpolate(pointSpring, [0, 1], itemScale);

          // Checkmark appears slightly after text
          const checkDelay = staggerDelay + (a.check.delay ?? 8);
          const checkFade = a.check.fadeDuration ?? 10;
          const checkOpacity = interpolate(frame, [checkDelay, checkDelay + checkFade], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          });

          return (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 24,
                opacity: pointOpacity,
                transform: `translateX(${pointX}px) scale(${pointScale})`,
              }}
            >
              {/* Number badge */}
              <div
                style={{
                  minWidth: 52,
                  height: 52,
                  borderRadius: 14,
                  background: `rgba(196,123,90,${0.08 + checkOpacity * 0.15})`,
                  border: `2px solid ${theme.color.surfaceBorder}`,
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  fontSize: 26,
                  fontWeight: 700,
                  color: theme.color.accent,
                }}
              >
                {i + 1}
              </div>

              {/* Point text */}
              <span
                style={{
                  fontSize: 40,
                  lineHeight: 1.5,
                  fontWeight: 500,
                  color: theme.color.textPrimary,
                }}
              >
                {point}
              </span>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
