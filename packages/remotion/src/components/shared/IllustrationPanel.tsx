import { Img, staticFile } from 'remotion';

interface IllustrationPanelProps {
  src: string;
  alt?: string;
  layout?: 'left' | 'right' | 'behind';
  size?: number;
  opacity?: number;
  style?: React.CSSProperties;
}

export const IllustrationPanel: React.FC<IllustrationPanelProps> = ({
  src,
  layout = 'right',
  size = 400,
  opacity = 1,
  style,
}) => {
  const resolvedSrc = src.startsWith('http') ? src : staticFile(src);

  if (layout === 'behind') {
    return (
      <div
        style={{
          position: 'absolute',
          right: -60,
          bottom: -40,
          opacity: opacity * 0.22,
          pointerEvents: 'none',
          ...style,
        }}
      >
        <Img
          src={resolvedSrc}
          width={size}
          height={size}
          style={{ objectFit: 'contain' }}
        />
      </div>
    );
  }

  return (
    <Img
      src={resolvedSrc}
      width={size}
      height={size}
      style={{
        objectFit: 'contain',
        opacity,
        flexShrink: 0,
        ...style,
      }}
    />
  );
};
