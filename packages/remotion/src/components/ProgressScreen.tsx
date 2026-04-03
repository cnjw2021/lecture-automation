import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';

interface ProgressScreenProps {
  steps: string[];
  currentStep: number;
  title?: string;
}

export const ProgressScreen: React.FC<ProgressScreenProps> = ({
  steps,
  currentStep,
  title,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Title animation
  const titleSpring = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 80, mass: 0.8 },
  });
  const titleOpacity = interpolate(titleSpring, [0, 1], [0, 1]);

  return (
    <AbsoluteFill
      style={{
        background: 'linear-gradient(160deg, #0f0c29 0%, #1a1a2e 50%, #16213e 100%)',
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
            color: '#e2e8f0',
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
          const stepDelay = 10 + i * 15;
          const stepSpring = spring({
            frame: Math.max(0, frame - stepDelay),
            fps,
            config: { damping: 14, stiffness: 70, mass: 0.7 },
          });
          const stepOpacity = interpolate(stepSpring, [0, 1], [0, 1]);
          const stepX = interpolate(stepSpring, [0, 1], [-40, 0]);

          const isActive = i + 1 === currentStep;
          const isPast = i + 1 < currentStep;

          // Active step pulse
          const pulseScale = isActive
            ? interpolate(
                Math.sin(frame * 0.08),
                [-1, 1],
                [1, 1.02]
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
                  ? 'rgba(99,102,241,0.15)'
                  : 'transparent',
                border: isActive
                  ? '2px solid rgba(99,102,241,0.4)'
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
                    ? '#6366f1'
                    : isPast
                      ? 'rgba(99,102,241,0.3)'
                      : 'rgba(255,255,255,0.08)',
                  color: isActive || isPast ? '#ffffff' : 'rgba(255,255,255,0.4)',
                  border: isActive
                    ? 'none'
                    : isPast
                      ? '2px solid rgba(99,102,241,0.5)'
                      : '2px solid rgba(255,255,255,0.15)',
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
                    ? '#ffffff'
                    : isPast
                      ? 'rgba(255,255,255,0.5)'
                      : 'rgba(255,255,255,0.6)',
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
          background: 'rgba(255,255,255,0.08)',
        }}
      >
        <div
          style={{
            height: '100%',
            borderRadius: 3,
            background: 'linear-gradient(90deg, #6366f1, #a78bfa)',
            width: `${(currentStep / steps.length) * 100}%`,
            transition: 'width 0.3s',
          }}
        />
      </div>
    </AbsoluteFill>
  );
};
