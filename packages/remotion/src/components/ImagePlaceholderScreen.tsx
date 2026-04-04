import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';
import { theme } from '../theme';
import { NodeIcon } from './NodeIcon';
import { getAnimConfig, resolveSpring } from '../animation';
import type { ElementAnim } from '../animation';

interface ImagePlaceholderScreenProps {
  title: string;
  description?: string;
  icon?: string;
  label?: string;
  layout?: 'left' | 'right';
  color?: string;
  animation?: Record<string, Partial<ElementAnim>>;
}

interface ImagePlaceholderScreenAnim {
  image: ElementAnim;
  text: ElementAnim;
}

export const ImagePlaceholderScreen: React.FC<ImagePlaceholderScreenProps> = ({
  title,
  description,
  icon,
  label,
  layout = 'left',
  color,
  animation,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const a = getAnimConfig<ImagePlaceholderScreenAnim>('ImagePlaceholderScreen', animation);
  const accentColor = color || theme.color.accent;

  const imgDelay = a.image?.delay ?? 5;
  const imgSpring = spring({ frame: Math.max(0, frame - imgDelay), fps, config: resolveSpring(a.image?.spring) });
  const imgOpacity = interpolate(imgSpring, [0, 1], [0, 1]);
  const imgScale = interpolate(imgSpring, [0, 1], [0.9, 1]);

  const txtDelay = a.text?.delay ?? 15;
  const txtSpring = spring({ frame: Math.max(0, frame - txtDelay), fps, config: resolveSpring(a.text?.spring) });
  const txtOpacity = interpolate(txtSpring, [0, 1], [0, 1]);
  const txtX = interpolate(txtSpring, [0, 1], [layout === 'left' ? 40 : -40, 0]);

  const imageBlock = (
    <div
      style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: imgOpacity,
        transform: `scale(${imgScale})`,
      }}
    >
      <div
        style={{
          width: 520,
          height: 520,
          borderRadius: 28,
          background: theme.color.surface,
          border: `2px dashed ${theme.color.surfaceBorder}`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 20,
        }}
      >
        {icon ? (
          <div style={{ width: 100, height: 100, borderRadius: '50%', background: `${accentColor}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <NodeIcon icon={icon} size={56} />
          </div>
        ) : (
          <div style={{ width: 80, height: 80, borderRadius: 16, background: `${accentColor}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 40, opacity: 0.4 }}>🖼</span>
          </div>
        )}
        {label && (
          <span style={{ fontSize: 22, color: theme.color.textMuted, fontWeight: 500 }}>{label}</span>
        )}
      </div>
    </div>
  );

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
