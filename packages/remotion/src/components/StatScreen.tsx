import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';
import { theme } from '../theme';
import { getAnimConfig, resolveSpring } from '../animation';
import type { ElementAnim } from '../animation';

interface StatScreenProps {
  value: string;
  label: string;
  description?: string;
  prefix?: string;
  suffix?: string;
  color?: string;
  animation?: Record<string, Partial<ElementAnim>>;
}

interface StatScreenAnim {
  value: ElementAnim;
  label: ElementAnim;
  description: ElementAnim;
  ring: ElementAnim;
}

export const StatScreen: React.FC<StatScreenProps> = ({
  value,
  label,
  description,
  prefix,
  suffix,
  color,
  animation,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const a = getAnimConfig<StatScreenAnim>('StatScreen', animation);

  const accentColor = color || theme.color.accent;

  // Ring scale-in
  const ringSpring = spring({
    frame,
    fps,
    config: resolveSpring(a.ring?.spring),
  });
  const ringScale = interpolate(ringSpring, [0, 1], [0, 1]);
  const ringRotation = interpolate(ringSpring, [0, 1], [-90, 0]);

  // Value count-up animation
  const valueDelay = a.value?.delay ?? 8;
  const valueSpring = spring({
    frame: Math.max(0, frame - valueDelay),
    fps,
    config: resolveSpring(a.value?.spring),
  });
  const valueScale = interpolate(valueSpring, [0, 1], [0.5, 1]);
  const valueOpacity = interpolate(valueSpring, [0, 1], [0, 1]);

  // Numeric count-up
  const numericValue = parseFloat(value);
  const isNumeric = !isNaN(numericValue);
  const countProgress = interpolate(frame, [valueDelay, valueDelay + 30], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const displayValue = isNumeric
    ? Math.round(numericValue * countProgress).toString()
    : value;

  // Label
  const labelDelay = a.label?.delay ?? 20;
  const labelSpring = spring({
    frame: Math.max(0, frame - labelDelay),
    fps,
    config: resolveSpring(a.label?.spring),
  });
  const labelOpacity = interpolate(labelSpring, [0, 1], [0, 1]);
  const labelY = interpolate(labelSpring, [0, 1], [a.label?.distance?.y ?? 30, 0]);

  // Description
  const descDelay = a.description?.delay ?? 32;
  const descSpring = spring({
    frame: Math.max(0, frame - descDelay),
    fps,
    config: resolveSpring(a.description?.spring),
  });
  const descOpacity = interpolate(descSpring, [0, 1], [0, 1]);

  return (
    <AbsoluteFill
      style={{
        background: theme.bg.primary,
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      {/* Decorative background ring */}
      <div
        style={{
          position: 'absolute',
          width: 420,
          height: 420,
          borderRadius: '50%',
          border: `3px solid ${accentColor}`,
          opacity: 0.12,
          transform: `scale(${ringScale}) rotate(${ringRotation}deg)`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          width: 500,
          height: 500,
          borderRadius: '50%',
          border: `1.5px dashed ${accentColor}`,
          opacity: 0.08,
          transform: `scale(${ringScale})`,
        }}
      />

      {/* Glow behind value */}
      <div
        style={{
          position: 'absolute',
          width: 600,
          height: 600,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${accentColor}12 0%, transparent 65%)`,
          transform: `scale(${ringScale})`,
        }}
      />

      <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', padding: '0 120px' }}>
        {/* Value */}
        <div
          style={{
            opacity: valueOpacity,
            transform: `scale(${valueScale})`,
            marginBottom: 20,
          }}
        >
          <span
            style={{
              fontSize: 160,
              fontWeight: 900,
              color: accentColor,
              lineHeight: 1,
              letterSpacing: '-0.03em',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {prefix && (
              <span style={{ fontSize: 80, opacity: 0.7, marginRight: 4 }}>{prefix}</span>
            )}
            {displayValue}
            {suffix && (
              <span style={{ fontSize: 80, opacity: 0.7, marginLeft: 4 }}>{suffix}</span>
            )}
          </span>
        </div>

        {/* Divider */}
        <div
          style={{
            width: interpolate(labelSpring, [0, 1], [0, 100]),
            height: 3,
            background: accentColor,
            margin: '0 auto 28px',
            borderRadius: 2,
            opacity: 0.6,
          }}
        />

        {/* Label */}
        <h2
          style={{
            fontSize: 52,
            fontWeight: 700,
            color: theme.color.textPrimary,
            opacity: labelOpacity,
            transform: `translateY(${labelY}px)`,
            marginBottom: 16,
          }}
        >
          {label}
        </h2>

        {/* Description */}
        {description && (
          <p
            style={{
              fontSize: 32,
              fontWeight: 400,
              color: theme.color.textSecondary,
              opacity: descOpacity,
              lineHeight: 1.6,
            }}
          >
            {description}
          </p>
        )}
      </div>
    </AbsoluteFill>
  );
};
