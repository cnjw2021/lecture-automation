import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';
import { theme } from '../theme';
import { NodeIcon } from './NodeIcon';
import { getAnimConfig, resolveSpring } from '../animation';
import type { ElementAnim } from '../animation';

interface TimelineEvent {
  label: string;
  description?: string;
  icon?: string;
  color?: string;
}

interface TimelineScreenProps {
  title?: string;
  events: TimelineEvent[];
  animation?: Record<string, Partial<ElementAnim>>;
}

interface TimelineScreenAnim {
  title: ElementAnim;
  line: ElementAnim;
  event: ElementAnim;
}

export const TimelineScreen: React.FC<TimelineScreenProps> = ({ title, events, animation }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const a = getAnimConfig<TimelineScreenAnim>('TimelineScreen', animation);

  // Title
  const titleSpring = spring({
    frame,
    fps,
    config: resolveSpring(a.title?.spring),
  });
  const titleOpacity = interpolate(titleSpring, [0, 1], [0, 1]);
  const titleY = interpolate(titleSpring, [0, 1], [a.title?.distance?.y ?? 30, 0]);

  // Layout calculations
  const leftMargin = 320;
  const topStart = title ? 170 : 100;
  const eventSpacing = Math.min(160, (850 - (title ? 0 : 70)) / Math.max(events.length - 1, 1));
  const baseDelay = (a.event?.baseDelay as number) ?? 12;
  const interval = a.event?.staggerInterval ?? 18;

  // Line grow animation
  const lastEventDelay = baseDelay + (events.length - 1) * interval;
  const lineHeight = interpolate(frame, [baseDelay, lastEventDelay + 15], [0, (events.length - 1) * eventSpacing], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{
        background: theme.bg.primary,
        padding: '60px 80px',
      }}
    >
      {/* Title */}
      {title && (
        <h1
          style={{
            fontSize: 52,
            fontWeight: 800,
            color: theme.color.textPrimary,
            opacity: titleOpacity,
            transform: `translateY(${titleY}px)`,
            marginBottom: 40,
            paddingLeft: 40,
          }}
        >
          {title}
        </h1>
      )}

      {/* Timeline area */}
      <div style={{ position: 'relative' }}>
        {/* Vertical line */}
        <div
          style={{
            position: 'absolute',
            left: leftMargin,
            top: topStart - 60,
            width: 3,
            height: lineHeight,
            background: theme.color.gradientLine,
            borderRadius: 2,
            opacity: 0.5,
          }}
        />

        {/* Events */}
        {events.map((event, i) => {
          const eventDelay = baseDelay + i * interval;
          const eventSpring = spring({
            frame: Math.max(0, frame - eventDelay),
            fps,
            config: resolveSpring(a.event?.spring),
          });
          const eventOpacity = interpolate(eventSpring, [0, 1], [0, 1]);
          const eventX = interpolate(eventSpring, [0, 1], [-40, 0]);
          const dotScale = interpolate(eventSpring, [0, 1], [0, 1]);
          const eventColor = event.color || theme.color.accent;
          const y = topStart - 60 + i * eventSpacing;

          return (
            <div
              key={i}
              style={{
                position: 'absolute',
                top: y,
                left: 0,
                right: 0,
                display: 'flex',
                alignItems: 'center',
                opacity: eventOpacity,
              }}
            >
              {/* Number badge (left side) */}
              <div
                style={{
                  width: 260,
                  textAlign: 'right',
                  paddingRight: 36,
                  opacity: eventOpacity,
                }}
              >
                <span
                  style={{
                    fontSize: 56,
                    fontWeight: 900,
                    color: eventColor,
                    opacity: 0.2,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {String(i + 1).padStart(2, '0')}
                </span>
              </div>

              {/* Dot on timeline */}
              <div
                style={{
                  position: 'relative',
                  width: 24,
                  height: 24,
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {/* Glow ring */}
                <div
                  style={{
                    position: 'absolute',
                    width: 40,
                    height: 40,
                    borderRadius: '50%',
                    background: `${eventColor}15`,
                    transform: `scale(${dotScale})`,
                  }}
                />
                <div
                  style={{
                    width: 14,
                    height: 14,
                    borderRadius: '50%',
                    background: eventColor,
                    transform: `scale(${dotScale})`,
                    boxShadow: `0 0 12px ${eventColor}40`,
                  }}
                />
              </div>

              {/* Content card */}
              <div
                style={{
                  marginLeft: 36,
                  transform: `translateX(${eventX}px)`,
                  padding: '20px 32px',
                  background: theme.color.surface,
                  borderRadius: 16,
                  borderLeft: `3px solid ${eventColor}`,
                  maxWidth: 900,
                }}
              >
                {/* Title row: icon + label aligned center */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                  {event.icon && (
                    <div style={{ flexShrink: 0 }}>
                      <NodeIcon icon={event.icon} size={40} />
                    </div>
                  )}
                  <h3
                    style={{
                      fontSize: 34,
                      fontWeight: 700,
                      color: theme.color.textPrimary,
                      margin: 0,
                      lineHeight: 1.3,
                    }}
                  >
                    {event.label}
                  </h3>
                </div>
                {event.description && (
                  <p
                    style={{
                      fontSize: 24,
                      color: theme.color.textSecondary,
                      lineHeight: 1.5,
                      margin: '6px 0 0',
                      paddingLeft: event.icon ? 60 : 0,
                    }}
                  >
                    {event.description}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
