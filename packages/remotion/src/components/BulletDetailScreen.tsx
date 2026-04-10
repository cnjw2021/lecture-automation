import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';
import { theme } from '../theme';
import { NodeIcon } from './NodeIcon';
import { getAnimConfig, resolveSpring } from '../animation';
import type { ElementAnim } from '../animation';

interface BulletItem {
  title: string;
  detail: string;
  icon?: string;
  color?: string;
}

interface BulletDetailScreenProps {
  title?: string;
  items: BulletItem[];
  animation?: Record<string, Partial<ElementAnim>>;
}

interface BulletDetailScreenAnim {
  title: ElementAnim;
  item: ElementAnim;
}

export const BulletDetailScreen: React.FC<BulletDetailScreenProps> = ({ title, items, animation }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const a = getAnimConfig<BulletDetailScreenAnim>('BulletDetailScreen', animation);

  const titleSpring = spring({ frame, fps, config: resolveSpring(a.title?.spring) });
  const titleOpacity = interpolate(titleSpring, [0, 1], [0, 1]);
  const titleY = interpolate(titleSpring, [0, 1], [30, 0]);

  const baseDelay = (a.item?.baseDelay as number) ?? 10;
  const interval = a.item?.staggerInterval ?? 16;

  return (
    <AbsoluteFill style={{ background: theme.bg.primary, padding: '80px 120px' }}>
      {title && (
        <h1 style={{ fontSize: 52, fontWeight: 800, color: theme.color.textPrimary, opacity: titleOpacity, transform: `translateY(${titleY}px)`, marginBottom: 48 }}>
          {title}
        </h1>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
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
                opacity: itemOpacity,
                transform: `translateX(${itemX}px)`,
                padding: '24px 32px',
                background: theme.color.surface,
                borderRadius: 16,
                borderLeft: `4px solid ${itemColor}`,
              }}
            >
              {/* Title row: icon + title aligned center */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
                {item.icon && (
                  <div style={{ flexShrink: 0 }}>
                    <NodeIcon icon={item.icon} size={40} />
                  </div>
                )}
                <h3 style={{ fontSize: 32, fontWeight: 700, color: theme.color.textPrimary, margin: 0, lineHeight: 1.3 }}>
                  {item.title}
                </h3>
              </div>
              <p style={{ fontSize: 24, color: theme.color.textSecondary, lineHeight: 1.6, margin: '8px 0 0', paddingLeft: item.icon ? 64 : 0 }}>
                {item.detail}
              </p>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
