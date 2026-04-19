import { theme } from '../../theme';

interface ConnectorLabelProps {
  label: string;
  style?: React.CSSProperties;
}

export const ConnectorLabel: React.FC<ConnectorLabelProps> = ({ label, style }) => {
  return (
    <span
      style={{
        fontSize: 16,
        fontWeight: 600,
        color: theme.infographic.connector,
        background: theme.infographic.badgeBg,
        border: `1px solid ${theme.infographic.panelBorder}`,
        borderRadius: theme.radius.pill,
        padding: '3px 12px',
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      {label}
    </span>
  );
};
