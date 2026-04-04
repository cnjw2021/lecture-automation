import { Img, staticFile } from 'remotion';
import { theme } from '../theme';
import { resolveIcon } from '../icons/resolveIcon';

interface NodeIconProps {
  icon: string;
  size?: number;
}

export const NodeIcon: React.FC<NodeIconProps> = ({ icon, size = 44 }) => {
  const resolved = resolveIcon(icon);

  switch (resolved.type) {
    case 'brand':
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
          size={size * 0.75}
          color={theme.color.accent}
          strokeWidth={1.8}
        />
      );
    }

    case 'emoji':
      return (
        <span style={{
          fontSize: size * 0.8,
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
          fontSize: size * 0.45,
          fontWeight: 700,
          color: theme.color.accent,
          lineHeight: 1,
        }}>
          {resolved.value}
        </span>
      );
  }
};
