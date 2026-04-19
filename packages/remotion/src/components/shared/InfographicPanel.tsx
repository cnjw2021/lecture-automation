import { theme } from '../../theme';

interface InfographicPanelProps {
  children: React.ReactNode;
  variant?: 'default' | 'strong' | 'floating';
  borderAccent?: string;
  borderPosition?: 'top' | 'left' | 'none';
  style?: React.CSSProperties;
}

export const InfographicPanel: React.FC<InfographicPanelProps> = ({
  children,
  variant = 'default',
  borderAccent,
  borderPosition = 'none',
  style,
}) => {
  const bg =
    variant === 'strong' ? theme.infographic.panelBgStrong : theme.infographic.panelBg;
  const border =
    variant === 'strong' ? theme.infographic.panelBorderStrong : theme.infographic.panelBorder;
  const shadow =
    variant === 'floating'
      ? theme.elevation.floating
      : variant === 'strong'
      ? theme.elevation.raised
      : theme.elevation.subtle;

  const accentBorder: React.CSSProperties = {};
  if (borderAccent && borderPosition === 'top') {
    accentBorder.borderTop = `4px solid ${borderAccent}`;
    accentBorder.borderRadius = `${theme.radius.card}px`;
  } else if (borderAccent && borderPosition === 'left') {
    accentBorder.borderLeft = `5px solid ${borderAccent}`;
    accentBorder.borderRadius = `0 ${theme.radius.card}px ${theme.radius.card}px 0`;
  }

  return (
    <div
      style={{
        background: bg,
        border: `1px solid ${border}`,
        borderRadius: theme.radius.card,
        boxShadow: shadow,
        ...accentBorder,
        ...style,
      }}
    >
      {children}
    </div>
  );
};
