import { AbsoluteFill, Img, staticFile, useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';
import { theme } from '../theme';
import { getAnimConfig, resolveSpring } from '../animation';
import type { ElementAnim } from '../animation';

interface ImageScreenProps {
  src: string;
  title?: string;
  description?: string;
  layout?: 'left' | 'right' | 'full';
  color?: string;
  animation?: Record<string, Partial<ElementAnim>>;
}

interface ImageScreenAnim {
  image: ElementAnim;
  text: ElementAnim;
}

export const ImageScreen: React.FC<ImageScreenProps> = ({
  src,
  title,
  description,
  layout = 'right',
  color,
  animation,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const a = getAnimConfig<ImageScreenAnim>('ImageScreen', animation);
  const accentColor = color || theme.color.accent;

  const imgDelay = a.image?.delay ?? 5;
  const imgSpring = spring({ frame: Math.max(0, frame - imgDelay), fps, config: resolveSpring(a.image?.spring) });
  const imgOpacity = interpolate(imgSpring, [0, 1], [0, 1]);
  const imgScale = interpolate(imgSpring, [0, 1], [0.92, 1]);

  const txtDelay = a.text?.delay ?? 18;
  const txtSpring = spring({ frame: Math.max(0, frame - txtDelay), fps, config: resolveSpring(a.text?.spring) });
  const txtOpacity = interpolate(txtSpring, [0, 1], [0, 1]);
  const txtX = interpolate(txtSpring, [0, 1], [layout === 'left' ? 40 : -40, 0]);

  const imageBlock = (
    <div
      style={{
        flex: layout === 'full' ? undefined : 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: imgOpacity,
        transform: `scale(${imgScale})`,
        padding: layout === 'full' ? '0 80px' : '20px',
      }}
    >
      <div
        style={{
          borderRadius: 16,
          overflow: 'hidden',
          boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
          maxWidth: layout === 'full' ? 1400 : 900,
          width: '100%',
        }}
      >
        <Img
          src={src.startsWith('http') ? src : staticFile(src)}
          style={{ width: '100%', height: 'auto', display: 'block' }}
        />
      </div>
    </div>
  );

  if (layout === 'full') {
    return (
      <AbsoluteFill style={{ background: theme.bg.primary }}>
        {title && (
          <div
            style={{
              position: 'absolute',
              top: 60,
              left: 80,
              right: 80,
              opacity: txtOpacity,
              transform: `translateX(${txtX}px)`,
            }}
          >
            <h1 style={{ fontSize: 48, fontWeight: 800, color: theme.color.textPrimary, margin: 0 }}>{title}</h1>
            {description && (
              <p style={{ fontSize: 26, color: theme.color.textSecondary, margin: '12px 0 0' }}>{description}</p>
            )}
          </div>
        )}
        <div style={{ position: 'absolute', top: title ? 180 : 60, left: 0, right: 0, bottom: 60 }}>
          {imageBlock}
        </div>
      </AbsoluteFill>
    );
  }

  const textBlock = (
    <div
      style={{
        flex: 1,
        padding: '40px 50px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        opacity: txtOpacity,
        transform: `translateX(${txtX}px)`,
      }}
    >
      <h1 style={{ fontSize: 52, fontWeight: 800, color: theme.color.textPrimary, lineHeight: 1.3, marginBottom: 24 }}>
        {title}
      </h1>
      <div style={{ width: 80, height: 4, background: accentColor, borderRadius: 2, marginBottom: 28, opacity: 0.6 }} />
      {description && (
        <p style={{ fontSize: 30, color: theme.color.textSecondary, lineHeight: 1.7, margin: 0 }}>
          {description}
        </p>
      )}
    </div>
  );

  return (
    <AbsoluteFill style={{ background: theme.bg.primary }}>
      <div style={{ display: 'flex', width: '100%', height: '100%', alignItems: 'center', padding: '60px 80px' }}>
        {layout === 'left' ? <>{imageBlock}{textBlock}</> : <>{textBlock}{imageBlock}</>}
      </div>
    </AbsoluteFill>
  );
};
