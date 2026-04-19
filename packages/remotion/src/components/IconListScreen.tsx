import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';
import { theme } from '../theme';
import { NodeIcon } from './NodeIcon';
import { getAnimConfig, resolveSpring } from '../animation';
import type { ElementAnim } from '../animation';

interface IconItem {
  icon: string;
  title: string;
  description?: string;
  color?: string;
}

interface IconListScreenProps {
  title?: string;
  items: IconItem[];
  animation?: Record<string, Partial<ElementAnim>>;
}

interface IconListScreenAnim {
  title: ElementAnim;
  item: ElementAnim;
}

export const IconListScreen: React.FC<IconListScreenProps> = ({ title, items, animation }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const a = getAnimConfig<IconListScreenAnim>('IconListScreen', animation);

  const titleSpring = spring({ frame, fps, config: resolveSpring(a.title?.spring) });
  const titleOpacity = interpolate(titleSpring, [0, 1], [0, 1]);
  const titleY = interpolate(titleSpring, [0, 1], [30, 0]);

  const baseDelay = (a.item?.baseDelay as number) ?? 10;
  const interval = a.item?.staggerInterval ?? 14;

  return (
    <AbsoluteFill style={{ background: theme.bg.primary, padding: '80px 120px' }}>
      {title && (
        <h1 style={{ fontSize: 52, fontWeight: 800, color: theme.color.textPrimary, opacity: titleOpacity, transform: `translateY(${titleY}px)`, marginBottom: 48 }}>
          {title}
        </h1>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {items.map((item, i) => {
          const itemDelay = baseDelay + i * interval;
          const itemSpring = spring({ frame: Math.max(0, frame - itemDelay), fps, config: resolveSpring(a.item?.spring) });
          const itemOpacity = interpolate(itemSpring, [0, 1], [0, 1]);
          const itemX = interpolate(itemSpring, [0, 1], [-40, 0]);
          const itemColor = item.color || theme.color.accent;

          return (
            <div
              key={i}
              style={{
                padding: '20px 28px',
                borderRadius: 16,
                background: theme.color.surface,
                border: `1px solid ${theme.color.divider}`,
                opacity: itemOpacity,
                transform: `translateX(${itemX}px)`,
              }}
            >
              {/* Title row: icon + title aligned center */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
                <div
                  style={{
                    width: 60,
                    height: 60,
                    borderRadius: '50%',
                    background: `${itemColor}15`,
                    border: `1.5px solid ${itemColor}25`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <NodeIcon icon={item.icon} size={32} variant="lucide-accent" color={itemColor} />
                </div>
                <h3 style={{ fontSize: 30, fontWeight: 700, color: theme.color.textPrimary, margin: 0, lineHeight: 1.3 }}>
                  {item.title}
                </h3>
              </div>
              {item.description && (
                <p style={{ fontSize: 22, color: theme.color.textSecondary, lineHeight: 1.5, margin: '4px 0 0', paddingLeft: 84 }}>
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
