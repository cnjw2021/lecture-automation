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
  // highlighted는 "caller가 그린 강조 배경 위에 놓이는 글리프" 역할이라
  // 배경 tint 신호로 전달되는 color를 그대로 글리프 색으로 쓰면 대비가 무너진다.
  if (variant === 'highlighted') {
    return theme.color.textOnAccent;
  }

  if (color) {
    return color;
  }

  switch (variant) {
    case 'lucide-muted':
      return theme.color.textMuted;
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
        <LucideIcon
          size={variant === 'highlighted' ? size * 0.82 : size * 0.75}
          color={toneColor}
          strokeWidth={variant === 'highlighted' ? 2.1 : 1.8}
        />
      );
    }

    case 'emoji':
      return (
        <span style={{
          fontSize: variant === 'highlighted' ? size * 0.88 : size * 0.8,
          lineHeight: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          {resolved.value}
        </span>
      );

    case 'text':
      return (
        <span style={{
          fontSize: variant === 'highlighted' ? size * 0.52 : size * 0.45,
          fontWeight: 700,
          color: toneColor,
          lineHeight: 1,
        }}>
          {resolved.value}
        </span>
      );
  }
};
