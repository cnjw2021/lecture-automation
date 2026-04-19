import { theme } from '../../theme';

export type BackdropVariant = 'blob' | 'mesh' | 'grid' | 'contour' | 'soft-shapes';

interface DecorativeBackdropProps {
  variant?: BackdropVariant;
  color?: string;
  opacity?: number;
}

export const DecorativeBackdrop: React.FC<DecorativeBackdropProps> = ({
  variant = 'blob',
  color,
  opacity = 0.07,
}) => {
  const tint = color || theme.color.accent;

  if (variant === 'grid') {
    return (
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `radial-gradient(circle, ${tint} 1.5px, transparent 1.5px)`,
          backgroundSize: '52px 52px',
          opacity,
          pointerEvents: 'none',
        }}
      />
    );
  }

  if (variant === 'mesh') {
    return (
      <svg
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          opacity,
          pointerEvents: 'none',
        }}
        viewBox="0 0 1920 1080"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <pattern id="bd-mesh" x="0" y="0" width="64" height="64" patternUnits="userSpaceOnUse">
            <path d="M 64 0 L 0 0 0 64" fill="none" stroke={tint} strokeWidth="0.8" />
          </pattern>
        </defs>
        <rect width="1920" height="1080" fill="url(#bd-mesh)" />
      </svg>
    );
  }

  if (variant === 'blob') {
    return (
      <svg
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          opacity,
          pointerEvents: 'none',
        }}
        viewBox="0 0 1920 1080"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <ellipse cx="320" cy="280" rx="480" ry="360" fill={tint} />
        <ellipse cx="1640" cy="820" rx="400" ry="320" fill={tint} />
        <ellipse cx="1100" cy="180" rx="280" ry="220" fill={tint} />
      </svg>
    );
  }

  if (variant === 'contour') {
    return (
      <svg
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          opacity,
          pointerEvents: 'none',
        }}
        viewBox="0 0 1920 1080"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M 0 450 Q 480 220 960 540 Q 1440 860 1920 360 L 1920 1080 L 0 1080 Z"
          fill={tint}
        />
        <path
          d="M 0 550 Q 480 320 960 640 Q 1440 960 1920 460"
          stroke={tint}
          strokeWidth="2"
          fill="none"
        />
        <path
          d="M 0 650 Q 480 420 960 740 Q 1440 1060 1920 560"
          stroke={tint}
          strokeWidth="1.5"
          fill="none"
          opacity={0.5}
        />
      </svg>
    );
  }

  // soft-shapes
  return (
    <svg
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        opacity,
        pointerEvents: 'none',
      }}
      viewBox="0 0 1920 1080"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect
        x="80"
        y="60"
        width="220"
        height="220"
        rx="64"
        fill={tint}
        transform="rotate(18 190 170)"
      />
      <circle cx="1720" cy="880" r="200" fill={tint} />
      <rect
        x="1380"
        y="60"
        width="170"
        height="170"
        rx="48"
        fill={tint}
        transform="rotate(-22 1465 145)"
      />
      <circle cx="180" cy="920" r="130" fill={tint} />
      <rect
        x="920"
        y="880"
        width="140"
        height="140"
        rx="42"
        fill={tint}
        transform="rotate(10 990 950)"
      />
    </svg>
  );
};
