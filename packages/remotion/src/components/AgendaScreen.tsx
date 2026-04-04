import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';
import { theme } from '../theme';
import { NodeIcon } from './NodeIcon';
import { getAnimConfig, resolveSpring } from '../animation';
import type { ElementAnim } from '../animation';

interface AgendaItem {
  title: string;
  description?: string;
  icon?: string;
  duration?: string;
}

interface AgendaScreenProps {
  title?: string;
  items: AgendaItem[];
  activeIndex?: number;
  animation?: Record<string, Partial<ElementAnim>>;
}

interface AgendaScreenAnim {
  title: ElementAnim;
  item: ElementAnim;
  bar: ElementAnim;
}

export const AgendaScreen: React.FC<AgendaScreenProps> = ({
  title,
  items,
  activeIndex,
  animation,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const a = getAnimConfig<AgendaScreenAnim>('AgendaScreen', animation);

  // Title
  const titleSpring = spring({
    frame,
    fps,
    config: resolveSpring(a.title?.spring),
  });
  const titleOpacity = interpolate(titleSpring, [0, 1], [0, 1]);
  const titleY = interpolate(titleSpring, [0, 1], [a.title?.distance?.y ?? 30, 0]);

  const baseDelay = (a.item?.baseDelay as number) ?? 8;
  const interval = a.item?.staggerInterval ?? 14;

  return (
    <AbsoluteFill
      style={{
        background: theme.bg.primary,
        padding: '80px 120px',
      }}
    >
      {/* Title */}
      {title && (
        <h1
          style={{
            fontSize: 56,
            fontWeight: 800,
            color: theme.color.textPrimary,
            opacity: titleOpacity,
            transform: `translateY(${titleY}px)`,
            marginBottom: 56,
          }}
        >
          {title}
        </h1>
      )}

      {/* Items */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {items.map((item, i) => {
          const itemDelay = baseDelay + i * interval;
          const itemSpring = spring({
            frame: Math.max(0, frame - itemDelay),
            fps,
            config: resolveSpring(a.item?.spring),
          });
          const itemOpacity = interpolate(itemSpring, [0, 1], [0, 1]);
          const itemX = interpolate(itemSpring, [0, 1], [-60, 0]);

          const isActive = activeIndex !== undefined && i === activeIndex;
          const isPast = activeIndex !== undefined && i < activeIndex;

          // Progress bar animation
          const barDelay = itemDelay + 8;
          const barWidth = interpolate(frame, [barDelay, barDelay + 20], [0, 100], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          });

          return (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'stretch',
                gap: 28,
                opacity: itemOpacity,
                transform: `translateX(${itemX}px)`,
              }}
            >
              {/* Large number */}
              <div
                style={{
                  width: 88,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <span
                  style={{
                    fontSize: 64,
                    fontWeight: 900,
                    color: isActive ? theme.color.accent : theme.color.textPrimary,
                    opacity: isActive ? 1 : isPast ? 0.3 : 0.15,
                    lineHeight: 1,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {i + 1}
                </span>
              </div>

              {/* Card */}
              <div
                style={{
                  flex: 1,
                  padding: '24px 32px',
                  borderRadius: 16,
                  background: isActive ? theme.color.accentMuted : theme.color.surface,
                  border: isActive
                    ? `2px solid ${theme.color.surfaceBorder}`
                    : `1px solid ${theme.color.divider}`,
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                {/* Progress bar at bottom */}
                {isActive && (
                  <div
                    style={{
                      position: 'absolute',
                      bottom: 0,
                      left: 0,
                      height: 3,
                      width: `${barWidth}%`,
                      background: theme.color.gradientLine,
                      borderRadius: 2,
                    }}
                  />
                )}

                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  {/* Icon */}
                  {item.icon && (
                    <div style={{ flexShrink: 0 }}>
                      <NodeIcon icon={item.icon} size={36} />
                    </div>
                  )}

                  <div style={{ flex: 1 }}>
                    {/* Title row */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <h3
                        style={{
                          fontSize: 32,
                          fontWeight: isActive ? 700 : 500,
                          color: isPast ? theme.color.textMuted : theme.color.textPrimary,
                          textDecoration: isPast ? 'line-through' : 'none',
                          margin: 0,
                          lineHeight: 1.3,
                        }}
                      >
                        {item.title}
                      </h3>

                      {/* Duration badge */}
                      {item.duration && (
                        <span
                          style={{
                            fontSize: 20,
                            fontWeight: 600,
                            color: theme.color.accent,
                            opacity: 0.7,
                            whiteSpace: 'nowrap',
                            marginLeft: 20,
                          }}
                        >
                          {item.duration}
                        </span>
                      )}
                    </div>

                    {/* Description */}
                    {item.description && !isPast && (
                      <p
                        style={{
                          fontSize: 22,
                          color: theme.color.textSecondary,
                          lineHeight: 1.5,
                          margin: '6px 0 0',
                        }}
                      >
                        {item.description}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
