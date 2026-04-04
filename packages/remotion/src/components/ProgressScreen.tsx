import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';
import { theme } from '../theme';
import { getAnimConfig, resolveSpring, type ProgressScreenAnim } from '../animation';

interface ProgressScreenProps {
  steps: string[];
  currentStep: number;
  title?: string;
  animation?: Partial<Record<keyof ProgressScreenAnim, Record<string, unknown>>>;
}

export const ProgressScreen: React.FC<ProgressScreenProps> = ({
  steps,
  currentStep,
  title,
  animation,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const a = getAnimConfig<ProgressScreenAnim>('ProgressScreen', animation);

  // Title animation
  const titleSpring = spring({
    frame,
    fps,
    config: resolveSpring(a.title.spring),
  });
  const titleOpacity = interpolate(titleSpring, [0, 1], [0, 1]);

  // Step stagger config
  const stepBaseDelay = (a.step.baseDelay as number) ?? 10;
  const stepInterval = a.step.staggerInterval ?? 15;
  const pulseSpeed = a.pulse.speed ?? 0.08;
  const pulseRange = a.pulse.range ?? [1, 1.02];

  return (
    <AbsoluteFill
      style={{
        background: theme.bg.primary,
        padding: '80px 140px',
        justifyContent: 'center',
      }}
    >
      {/* Title */}
      {title && (
        <h1
          style={{
            fontSize: 56,
            fontWeight: 800,
            color: theme.color.textPrimary,
            marginBottom: 60,
            opacity: titleOpacity,
          }}
        >
          {title}
        </h1>
      )}

      {/* Steps */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        {steps.map((step, i) => {
          const stepDelay = stepBaseDelay + i * stepInterval;
          const stepSpring = spring({
            frame: Math.max(0, frame - stepDelay),
            fps,
            config: resolveSpring(a.step.spring),
          });
          const stepOpacity = interpolate(stepSpring, [0, 1], [0, 1]);
          const stepX = interpolate(stepSpring, [0, 1], [a.step.distance?.x ?? -40, 0]);

          const isActive = i + 1 === currentStep;
          const isPast = i + 1 < currentStep;

          // Active step pulse
          const pulseScale = isActive
            ? interpolate(
                Math.sin(frame * pulseSpeed),
                [-1, 1],
                pulseRange
              )
            : 1;

          return (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 24,
                opacity: stepOpacity,
                transform: `translateX(${stepX}px) scale(${pulseScale})`,
                padding: '18px 28px',
                borderRadius: 16,
                background: isActive
                  ? theme.color.accentMuted
                  : 'transparent',
                border: isActive
                  ? `2px solid ${theme.color.surfaceBorder}`
                  : '2px solid transparent',
              }}
            >
              {/* Step number/check */}
              <div
                style={{
                  minWidth: 52,
                  height: 52,
                  borderRadius: '50%',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  fontSize: 24,
                  fontWeight: 700,
                  background: isActive
                    ? theme.color.accent
                    : isPast
                      ? 'rgba(196,123,90,0.2)'
                      : 'rgba(45,41,38,0.06)',
                  color: isActive || isPast ? '#ffffff' : theme.color.textMuted,
                  border: isActive
                    ? 'none'
                    : isPast
                      ? `2px solid ${theme.color.surfaceBorder}`
                      : '2px solid rgba(45,41,38,0.1)',
                }}
              >
                {isPast ? '\u2713' : i + 1}
              </div>

              {/* Step text */}
              <span
                style={{
                  fontSize: 36,
                  fontWeight: isActive ? 700 : 400,
                  color: isActive
                    ? theme.color.textPrimary
                    : isPast
                      ? theme.color.textMuted
                      : theme.color.textSecondary,
                  textDecoration: isPast ? 'line-through' : 'none',
                }}
              >
                {step}
              </span>
            </div>
          );
        })}
      </div>

      {/* Progress bar at bottom */}
      <div
        style={{
          position: 'absolute',
          bottom: 60,
          left: 140,
          right: 140,
          height: 6,
          borderRadius: 3,
          background: theme.color.divider,
        }}
      >
        <div
          style={{
            height: '100%',
            borderRadius: 3,
            background: theme.color.gradientLine,
            width: `${(currentStep / steps.length) * 100}%`,
            transition: 'width 0.3s',
          }}
        />
      </div>
    </AbsoluteFill>
  );
};
