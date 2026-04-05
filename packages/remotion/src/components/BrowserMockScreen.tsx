import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';
import { theme } from '../theme';
import { getAnimConfig, resolveSpring } from '../animation';
import type { ElementAnim } from '../animation';
import { BrowserChrome } from './BrowserChrome';

interface BrowserMockScreenProps {
  url: string;
  title?: string;
  description?: string;
  layout?: 'left' | 'right' | 'full';
  color?: string;
  animation?: Record<string, Partial<ElementAnim>>;
}

interface BrowserMockScreenAnim {
  browser: ElementAnim;
  text: ElementAnim;
}

export const BrowserMockScreen: React.FC<BrowserMockScreenProps> = ({
  url,
  title,
  description,
  layout = 'right',
  color,
  animation,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const a = getAnimConfig<BrowserMockScreenAnim>('BrowserMockScreen', animation);
  const accentColor = color || theme.color.accent;

  const browserDelay = a.browser?.delay ?? 5;
  const browserSpring = spring({ frame: Math.max(0, frame - browserDelay), fps, config: resolveSpring(a.browser?.spring) });
  const browserOpacity = interpolate(browserSpring, [0, 1], [0, 1]);
  const browserScale = interpolate(browserSpring, [0, 1], [0.92, 1]);

  const textDelay = a.text?.delay ?? 18;
  const textSpring = spring({ frame: Math.max(0, frame - textDelay), fps, config: resolveSpring(a.text?.spring) });
  const textOpacity = interpolate(textSpring, [0, 1], [0, 1]);
  const textX = interpolate(textSpring, [0, 1], [layout === 'left' ? 40 : -40, 0]);

  const browserBlock = (
    <div
      style={{
        flex: layout === 'full' ? undefined : 1,
        width: layout === 'full' ? '100%' : undefined,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: browserOpacity,
        transform: `scale(${browserScale})`,
        padding: layout === 'full' ? '40px 80px' : '20px',
      }}
    >
      <div style={{ width: '100%', maxWidth: layout === 'full' ? 1400 : 900 }}>
        <BrowserChrome url={url} tabTitle={title}>
          {/* 목업 페이지 콘텐츠 */}
          <div
            style={{
              background: '#ffffff',
              height: layout === 'full' ? 400 : 420,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 16,
              borderTop: '1px solid #e0e0e0',
            }}
          >
            <span style={{ fontSize: 52, opacity: 0.25 }}>🌐</span>
            <span style={{ fontSize: 15, color: '#aaa', fontFamily: 'monospace' }}>{url}</span>
          </div>
        </BrowserChrome>
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
              opacity: textOpacity,
              transform: `translateX(${textX}px)`,
            }}
          >
            <h1 style={{ fontSize: 48, fontWeight: 800, color: theme.color.textPrimary, margin: 0 }}>{title}</h1>
            {description && (
              <p style={{ fontSize: 26, color: theme.color.textSecondary, margin: '12px 0 0' }}>{description}</p>
            )}
          </div>
        )}
        <div style={{ position: 'absolute', top: title ? 180 : 60, left: 0, right: 0, bottom: 0 }}>
          {browserBlock}
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
        opacity: textOpacity,
        transform: `translateX(${textX}px)`,
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
        {layout === 'left' ? <>{browserBlock}{textBlock}</> : <>{textBlock}{browserBlock}</>}
      </div>
    </AbsoluteFill>
  );
};
