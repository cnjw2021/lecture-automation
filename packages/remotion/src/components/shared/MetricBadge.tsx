import { useCurrentFrame, interpolate } from 'remotion';
import { theme } from '../../theme';

interface MetricBadgeProps {
  value: string;
  suffix?: string;
  label?: string;
  color?: string;
  size?: 'sm' | 'md' | 'lg';
  animate?: boolean;
}

export const MetricBadge: React.FC<MetricBadgeProps> = ({
  value,
  suffix,
  label,
  color,
  size = 'md',
  animate = false,
}) => {
  const frame = useCurrentFrame();
  const accentColor = color || theme.infographic.metricText;

  const numericValue = parseFloat(value);
  const isNumeric = !isNaN(numericValue);
  const countProgress = animate
    ? interpolate(frame, [0, 30], [0, 1], { extrapolateRight: 'clamp' })
    : 1;
  const displayValue =
    isNumeric && animate ? Math.round(numericValue * countProgress).toString() : value;

  const sizeMap = {
    sm: { valueSize: 28, labelSize: 14, padding: '6px 16px' },
    md: { valueSize: 40, labelSize: 16, padding: '8px 22px' },
    lg: { valueSize: 56, labelSize: 18, padding: '12px 32px' },
  };
  const s = sizeMap[size];

  return (
    <div
      style={{
        display: 'inline-flex',
        flexDirection: 'column',
        alignItems: 'center',
        background: theme.infographic.metricBg,
        borderRadius: theme.radius.pill,
        padding: s.padding,
        border: `1px solid ${accentColor}28`,
      }}
    >
      <span
        style={{
          fontSize: s.valueSize,
          fontWeight: 900,
          color: accentColor,
          lineHeight: 1,
          fontFamily: 'Inter, sans-serif',
          letterSpacing: '-0.02em',
        }}
      >
        {displayValue}
        {suffix}
      </span>
      {label && (
        <span
          style={{
            fontSize: s.labelSize,
            fontWeight: 500,
            color: theme.color.textMuted,
            marginTop: 4,
            fontFamily: 'Inter, sans-serif',
          }}
        >
          {label}
        </span>
      )}
    </div>
  );
};
