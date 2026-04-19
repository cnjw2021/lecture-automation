import { Img, staticFile } from 'remotion';
import { theme } from '../theme';
import { resolveIcon } from '../icons/resolveIcon';

export type NodeIconVariant =
  | 'brand-original'
  | 'brand-tinted'
  | 'lucide-accent'
  | 'lucide-muted'
  | 'highlighted';

interface NodeIconProps {
  icon: string;
  size?: number;
  variant?: NodeIconVariant;
  color?: string;
}

const getToneColor = (variant: NodeIconVariant, color?: string): string => {
  if (color) {
    return color;
  }

  switch (variant) {
    case 'lucide-muted':
      return theme.color.textMuted;
    case 'highlighted':
      return theme.color.textOnAccent;
    case 'brand-tinted':
      return theme.color.accentSecondary;
    case 'brand-original':
    case 'lucide-accent':
    default:
      return theme.color.accent;
  }
};

export const NodeIcon: React.FC<NodeIconProps> = ({
  icon,
  size = 44,
  variant = 'lucide-accent',
  color,
}) => {
  const resolved = resolveIcon(icon);
  const toneColor = getToneColor(variant, color);
  const highlightedWrapper: React.CSSProperties =
    variant === 'highlighted'
      ? {
          width: size,
          height: size,
          borderRadius: '50%',
          background: `linear-gradient(135deg, ${color || theme.color.accent} 0%, ${theme.color.accentSecondary} 100%)`,
          boxShadow: `0 14px 30px ${color || theme.color.accent}30`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }
      : {};

  switch (resolved.type) {
    case 'brand':
      if (variant === 'brand-tinted') {
        return (
          <div
            style={{
              width: size,
              height: size,
              borderRadius: size * 0.28,
              background: `${toneColor}14`,
              border: `1.5px solid ${toneColor}26`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Img
              src={staticFile(`icons/${resolved.name}.svg`)}
              width={size * 0.68}
              height={size * 0.68}
              style={{
                objectFit: 'contain',
                filter: 'grayscale(1) contrast(1.1)',
                opacity: 0.92,
              }}
            />
          </div>
        );
      }

      return (
        <Img
          src={staticFile(`icons/${resolved.name}.svg`)}
          width={size}
          height={size}
          style={{ borderRadius: size * 0.22, objectFit: 'contain' }}
        />
      );

    case 'lucide': {
      const LucideIcon = resolved.Component;
      return (
        <div style={highlightedWrapper}>
          <LucideIcon
            size={variant === 'highlighted' ? size * 0.48 : size * 0.75}
            color={toneColor}
            strokeWidth={variant === 'highlighted' ? 2.2 : 1.8}
          />
        </div>
      );
    }

    case 'emoji':
      return (
        <div style={highlightedWrapper}>
          <span style={{
            fontSize: variant === 'highlighted' ? size * 0.42 : size * 0.8,
            lineHeight: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            {resolved.value}
          </span>
        </div>
      );

    case 'text':
      return (
        <div style={highlightedWrapper}>
          <span style={{
            fontSize: variant === 'highlighted' ? size * 0.28 : size * 0.45,
            fontWeight: 700,
            color: toneColor,
            lineHeight: 1,
          }}>
            {resolved.value}
          </span>
        </div>
      );
  }
};
