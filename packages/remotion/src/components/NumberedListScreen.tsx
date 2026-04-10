import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';
import { theme } from '../theme';
import { getAnimConfig, resolveSpring } from '../animation';
import type { ElementAnim } from '../animation';

interface NumberedItem {
  title: string;
  description?: string;
}

interface NumberedListScreenProps {
  title?: string;
  items: NumberedItem[];
  animation?: Record<string, Partial<ElementAnim>>;
}

interface NumberedListScreenAnim {
  title: ElementAnim;
  item: ElementAnim;
}

export const NumberedListScreen: React.FC<NumberedListScreenProps> = ({ title, items, animation }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const a = getAnimConfig<NumberedListScreenAnim>('NumberedListScreen', animation);

  const titleSpring = spring({ frame, fps, config: resolveSpring(a.title?.spring) });
  const titleOpacity = interpolate(titleSpring, [0, 1], [0, 1]);

  const baseDelay = (a.item?.baseDelay as number) ?? 10;
  const interval = a.item?.staggerInterval ?? 16;

  return (
    <AbsoluteFill style={{ background: theme.bg.primary, padding: '80px 120px' }}>
      {title && (
        <h1 style={{ fontSize: 52, fontWeight: 800, color: theme.color.textPrimary, opacity: titleOpacity, marginBottom: 52 }}>
          {title}
        </h1>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
        {items.map((item, i) => {
          const itemDelay = baseDelay + i * interval;
          const itemSpring = spring({ frame: Math.max(0, frame - itemDelay), fps, config: resolveSpring(a.item?.spring) });
          const itemOpacity = interpolate(itemSpring, [0, 1], [0, 1]);
          const itemX = interpolate(itemSpring, [0, 1], [-50, 0]);

          return (
            <div
              key={i}
              style={{
                opacity: itemOpacity,
                transform: `translateX(${itemX}px)`,
              }}
            >
              {/* Title row: circle + title aligned center */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
                <div
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: '50%',
                    background: `linear-gradient(135deg, ${theme.color.accent}, ${theme.color.accent}cc)`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    boxShadow: `0 4px 16px ${theme.color.accent}30`,
                  }}
                >
                  <span style={{ fontSize: 30, fontWeight: 800, color: theme.color.textOnAccent }}>
                    {i + 1}
                  </span>
                </div>
                <h3 style={{ fontSize: 34, fontWeight: 700, color: theme.color.textPrimary, margin: 0, lineHeight: 1.3 }}>
                  {item.title}
                </h3>
              </div>
              {item.description && (
                <p style={{ fontSize: 26, color: theme.color.textSecondary, lineHeight: 1.6, margin: '6px 0 0', paddingLeft: 92 }}>
                  {item.description}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
