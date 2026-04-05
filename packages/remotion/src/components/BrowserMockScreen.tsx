import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';
import { theme } from '../theme';
import { getAnimConfig, resolveSpring } from '../animation';
import type { ElementAnim } from '../animation';

interface BrowserMockScreenProps {
  url: string;
  title?: string;
  description?: string;
  layout?: 'left' | 'right' | 'full';
  highlightUrl?: boolean;
  animation?: Record<string, Partial<ElementAnim>>;
}

interface BrowserMockScreenAnim {
  browser: ElementAnim;
  text: ElementAnim;
  urlBar: ElementAnim;
}

const BROWSER_BG = '#f5f5f5';
const CHROME_BG = '#e8e8e8';
const TAB_BG = '#ffffff';
const URL_BAR_BG = '#ffffff';
const DOT_RED = '#ff5f57';
const DOT_YELLOW = '#febc2e';
const DOT_GREEN = '#28c840';

export const BrowserMockScreen: React.FC<BrowserMockScreenProps> = ({
  url,
  title,
  description,
  layout = 'right',
  highlightUrl = true,
  animation,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const a = getAnimConfig<BrowserMockScreenAnim>('BrowserMockScreen', animation);

  const browserDelay = a.browser?.delay ?? 5;
  const browserSpring = spring({ frame: Math.max(0, frame - browserDelay), fps, config: resolveSpring(a.browser?.spring) });
  const browserOpacity = interpolate(browserSpring, [0, 1], [0, 1]);
  const browserScale = interpolate(browserSpring, [0, 1], [0.92, 1]);

  const textDelay = a.text?.delay ?? 18;
  const textSpring = spring({ frame: Math.max(0, frame - textDelay), fps, config: resolveSpring(a.text?.spring) });
  const textOpacity = interpolate(textSpring, [0, 1], [0, 1]);
  const textX = interpolate(textSpring, [0, 1], [layout === 'left' ? 40 : -40, 0]);

  const urlDelay = a.urlBar?.delay ?? 25;
  const urlSpring = spring({ frame: Math.max(0, frame - urlDelay), fps, config: resolveSpring(a.urlBar?.spring) });
  const urlOpacity = interpolate(urlSpring, [0, 1], [0, 1]);

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
      <div
        style={{
          width: '100%',
          maxWidth: layout === 'full' ? 1400 : 620,
          borderRadius: 12,
          overflow: 'hidden',
          boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
          background: BROWSER_BG,
        }}
      >
        {/* Chrome — title bar */}
        <div
          style={{
            background: CHROME_BG,
            padding: '10px 16px 0',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          {/* Traffic lights */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, paddingBottom: 6 }}>
            {[DOT_RED, DOT_YELLOW, DOT_GREEN].map((color, i) => (
              <div key={i} style={{ width: 13, height: 13, borderRadius: '50%', background: color }} />
            ))}
          </div>

          {/* Tab row */}
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2 }}>
            <div
              style={{
                background: TAB_BG,
                borderRadius: '8px 8px 0 0',
                padding: '6px 20px',
                fontSize: 13,
                color: '#333',
                maxWidth: 200,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {title || url}
            </div>
          </div>
        </div>

        {/* Address bar */}
        <div
          style={{
            background: CHROME_BG,
            padding: '8px 14px 10px',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          {/* Nav buttons */}
          {['←', '→', '↻'].map((btn, i) => (
            <div
              key={i}
              style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                background: '#d0d0d0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 14,
                color: '#666',
                flexShrink: 0,
              }}
            >
              {btn}
            </div>
          ))}

          {/* URL input */}
          <div
            style={{
              flex: 1,
              background: URL_BAR_BG,
              borderRadius: 20,
              padding: '6px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              opacity: urlOpacity,
              border: highlightUrl ? `2px solid ${theme.color.accent}` : '2px solid transparent',
              boxShadow: highlightUrl ? `0 0 0 3px ${theme.color.accent}22` : 'none',
            }}
          >
            {/* Lock icon */}
            <span style={{ fontSize: 13, color: '#4CAF50', flexShrink: 0 }}>🔒</span>
            <span
              style={{
                fontSize: 14,
                color: '#333',
                fontFamily: 'monospace',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {url}
            </span>
          </div>
        </div>

        {/* Page content area */}
        <div
          style={{
            background: '#ffffff',
            height: layout === 'full' ? 400 : 260,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderTop: '1px solid #e0e0e0',
          }}
        >
          <div style={{ textAlign: 'center', color: '#ccc' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🌐</div>
            <div style={{ fontSize: 16, color: '#bbb' }}>{url}</div>
          </div>
        </div>
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
      <div style={{ width: 80, height: 4, background: theme.color.accent, borderRadius: 2, marginBottom: 28, opacity: 0.6 }} />
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
