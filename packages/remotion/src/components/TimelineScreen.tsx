import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';
import { theme, typographyStyle } from '../theme';
import { NodeIcon } from './NodeIcon';
import { getAnimConfig, resolveSpring } from '../animation';
import type { ElementAnim } from '../animation';
import { SectionEyebrow, MetricBadge, InfographicPanel, DecorativeBackdrop } from './shared';
import type { BackdropVariant } from './shared';

interface TimelineEvent {
  label: string;
  description?: string;
  icon?: string;
  color?: string;
}

interface TimelineScreenProps {
  title?: string;
  events: TimelineEvent[];
  eyebrow?: string;
  badge?: string;
  metric?: string;
  caption?: string;
  backdropVariant?: BackdropVariant;
  subtitle?: string;
  footnote?: string;
  animation?: Record<string, Partial<ElementAnim>>;
}

interface TimelineScreenAnim {
  title: ElementAnim;
  line: ElementAnim;
  event: ElementAnim;
}

export const TimelineScreen: React.FC<TimelineScreenProps> = ({
  title,
  events,
  eyebrow,
  badge,
  metric,
  caption,
  backdropVariant,
  subtitle,
  footnote,
  animation,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const a = getAnimConfig<TimelineScreenAnim>('TimelineScreen', animation);

  const titleSpring = spring({ frame, fps, config: resolveSpring(a.title?.spring) });
  const titleOpacity = interpolate(titleSpring, [0, 1], [0, 1]);
  const titleY = interpolate(titleSpring, [0, 1], [a.title?.distance?.y ?? 30, 0]);

  const hasHeader = !!(eyebrow || title || badge || metric || subtitle);
  const leftMargin = 300;
  const topStart = hasHeader ? 180 : 100;
  const eventSpacing = Math.min(156, (820 - (hasHeader ? 0 : 60)) / Math.max(events.length - 1, 1));
  const baseDelay = (a.event?.baseDelay as number) ?? 12;
  const interval = a.event?.staggerInterval ?? 18;
  const lastEventDelay = baseDelay + (events.length - 1) * interval;
  const lineHeight = interpolate(
    frame,
    [baseDelay, lastEventDelay + 15],
    [0, (events.length - 1) * eventSpacing],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  const headlineSpec = typographyStyle('headline');
  const captionSpec = typographyStyle('caption');

  return (
    <AbsoluteFill
      style={{ background: theme.bg.primary, padding: '56px 80px', overflow: 'hidden' }}
    >
      {backdropVariant && (
        <DecorativeBackdrop variant={backdropVariant} color={theme.color.accent} opacity={0.055} />
      )}

      {/* Header */}
      {hasHeader && (
        <div
          style={{
            marginBottom: 20,
            opacity: titleOpacity,
            transform: `translateY(${titleY}px)`,
            paddingLeft: 40,
          }}
        >
          {eyebrow && <SectionEyebrow text={eyebrow} />}
          <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
            {title && (
              <h1 style={{ ...headlineSpec, color: theme.color.textPrimary, margin: 0, flex: 1 }}>
                {title}
              </h1>
            )}
            {badge && (
              <span
                style={{
                  fontSize: 17,
                  fontWeight: 700,
                  color: theme.infographic.badgeText,
                  background: theme.infographic.badgeBg,
                  border: `1px solid ${theme.infographic.panelBorder}`,
                  borderRadius: theme.radius.pill,
                  padding: '4px 14px',
                  fontFamily: theme.font.numeric,
                  textTransform: 'uppercase' as const,
                  letterSpacing: '0.04em',
                }}
              >
                {badge}
              </span>
            )}
            {metric && (
              <MetricBadge value={metric} color={theme.color.accent} size="sm" animate />
            )}
          </div>
          {subtitle && (
            <p style={{ ...captionSpec, color: theme.color.textSecondary, marginTop: 6, fontWeight: 400 }}>
              {subtitle}
            </p>
          )}
        </div>
      )}

      {/* Fallback title */}
      {!hasHeader && title && (
        <h1
          style={{
            fontSize: 52,
            fontWeight: 800,
            color: theme.color.textPrimary,
            opacity: titleOpacity,
            transform: `translateY(${titleY}px)`,
            marginBottom: 36,
            paddingLeft: 40,
          }}
        >
          {title}
        </h1>
      )}

      {/* Timeline area */}
      <div style={{ position: 'relative', flex: 1 }}>
        {/* Vertical flow line */}
        <div
          style={{
            position: 'absolute',
            left: leftMargin,
            top: topStart - 56,
            width: 3,
            height: lineHeight,
            background: `linear-gradient(to bottom, ${theme.infographic.connector}80, ${theme.infographic.connector}20)`,
            borderRadius: 2,
          }}
        />

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
          const y = topStart - 56 + i * eventSpacing;

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
              {/* Step number */}
              <div style={{ width: leftMargin - 28, textAlign: 'right', paddingRight: 32 }}>
                <span
                  style={{
                    fontSize: 52,
                    fontWeight: 900,
                    color: eventColor,
                    opacity: 0.22,
                    fontFamily: theme.font.numeric,
                    letterSpacing: '-0.03em',
                  }}
                >
                  {String(i + 1).padStart(2, '0')}
                </span>
              </div>

              {/* Dot */}
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
                <div
                  style={{
                    position: 'absolute',
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    background: `${eventColor}18`,
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
                    boxShadow: `0 0 10px ${eventColor}50`,
                  }}
                />
              </div>

              {/* Card */}
              <div style={{ marginLeft: 32, transform: `translateX(${eventX}px)`, flex: 1 }}>
                <InfographicPanel
                  variant="strong"
                  borderAccent={eventColor}
                  borderPosition="left"
                  style={{ padding: '18px 28px' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
                    {event.icon && (
                      <div
                        style={{
                          width: 48,
                          height: 48,
                          borderRadius: theme.radius.card,
                          background: `${eventColor}16`,
                          border: `1.5px solid ${eventColor}28`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        <NodeIcon icon={event.icon} size={28} variant="lucide-accent" color={eventColor} />
                      </div>
                    )}
                    <div style={{ flex: 1 }}>
                      <h3
                        style={{
                          fontSize: 30,
                          fontWeight: 700,
                          color: theme.color.textPrimary,
                          margin: 0,
                          lineHeight: 1.3,
                        }}
                      >
                        {event.label}
                      </h3>
                      {event.description && (
                        <p
                          style={{
                            fontSize: 22,
                            color: theme.color.textSecondary,
                            lineHeight: 1.5,
                            margin: '4px 0 0',
                          }}
                        >
                          {event.description}
                        </p>
                      )}
                    </div>
                  </div>
                </InfographicPanel>
              </div>
            </div>
          );
        })}
      </div>

      {/* Caption / Footnote */}
      {(caption || footnote) && (
        <div
          style={{
            marginTop: 20,
            opacity: titleOpacity,
            borderTop: `1px solid ${theme.infographic.panelBorder}`,
            paddingTop: 12,
            paddingLeft: 40,
          }}
        >
          {caption && (
            <p style={{ ...captionSpec, color: theme.color.textMuted, margin: 0 }}>{caption}</p>
          )}
          {footnote && (
            <p style={{ fontSize: 18, color: theme.color.textMuted, margin: '4px 0 0', fontStyle: 'italic' }}>
              {footnote}
            </p>
          )}
        </div>
      )}
    </AbsoluteFill>
  );
};
