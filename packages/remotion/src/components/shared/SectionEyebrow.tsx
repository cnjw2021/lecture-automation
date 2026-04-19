import { theme, typographyStyle } from '../../theme';

interface SectionEyebrowProps {
  text: string;
  color?: string;
  style?: React.CSSProperties;
}

export const SectionEyebrow: React.FC<SectionEyebrowProps> = ({ text, color, style }) => {
  const spec = typographyStyle('eyebrow');
  return (
    <div
      style={{
        ...spec,
        textTransform: 'uppercase',
        color: color || theme.color.accent,
        opacity: 0.85,
        marginBottom: 10,
        ...style,
      }}
    >
      {text}
    </div>
  );
};
