import { theme } from '../../theme';
import { NodeIcon } from '../NodeIcon';
import type { NodeIconVariant } from '../NodeIcon';

interface IconBadgeProps {
  icon: string;
  size?: number;
  variant?: NodeIconVariant;
  color?: string;
  shape?: 'circle' | 'rounded-square';
  label?: string;
}

export const IconBadge: React.FC<IconBadgeProps> = ({
  icon,
  size = 56,
  variant = 'lucide-accent',
  color,
  shape = 'circle',
  label,
}) => {
  const accentColor = color || theme.color.accent;
  const containerSize = size * 1.52;
  const isHighlighted = variant === 'highlighted';

  const borderRadius =
    shape === 'circle' ? '50%' : `${Math.round(containerSize * 0.24)}px`;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 8,
      }}
    >
      <div
        style={{
          width: containerSize,
          height: containerSize,
          borderRadius,
          background: isHighlighted ? accentColor : `${accentColor}18`,
          border: `1.5px solid ${isHighlighted ? accentColor : `${accentColor}28`}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: isHighlighted ? theme.elevation.raised : theme.elevation.subtle,
          flexShrink: 0,
        }}
      >
        <NodeIcon icon={icon} size={size} variant={variant} color={color} />
      </div>
      {label && (
        <span
          style={{
            fontSize: 14,
            fontWeight: 500,
            color: theme.color.textMuted,
          }}
        >
          {label}
        </span>
      )}
    </div>
  );
};
