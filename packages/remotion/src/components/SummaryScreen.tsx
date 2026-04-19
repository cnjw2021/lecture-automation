import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';
import { theme, typographyStyle } from '../theme';
import { getAnimConfig, resolveSpring, type SummaryScreenAnim } from '../animation';
import {
  SectionEyebrow,
  MetricBadge,
  InfographicPanel,
  DecorativeBackdrop,
  IllustrationPanel,
} from './shared';
import type { BackdropVariant } from './shared';

interface SummaryScreenProps {
  points: string[];
  title?: string;
  eyebrow?: string;
  badge?: string;
  metric?: string;
  caption?: string;
  illustration?: string;
  backdropVariant?: BackdropVariant;
  footnote?: string;
  animation?: Partial<Record<keyof SummaryScreenAnim, Record<string, unknown>>>;
}

export const SummaryScreen: React.FC<SummaryScreenProps> = ({
  points,
  title,
  eyebrow,
  badge,
  metric,
  caption,
  illustration,
  backdropVariant,
  footnote,
  animation,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const a = getAnimConfig<SummaryScreenAnim>('SummaryScreen', animation);

  const displayTitle = title || 'まとめ';

  const titleSpring = spring({ frame, fps, config: resolveSpring(a.title.spring) });
  const titleX = interpolate(titleSpring, [0, 1], [a.title.distance?.x ?? -80, 0]);
  const titleOpacity = interpolate(titleSpring, [0, 1], [0, 1]);

  const headlineSpec = typographyStyle('headline');
  const captionSpec = typographyStyle('caption');

  return (
    <AbsoluteFill
      style={{
        background: theme.bg.primary,
        padding: '80px 120px',
        overflow: 'hidden',
      }}
    >
      {backdropVariant && (
        <DecorativeBackdrop variant={backdropVariant} color={theme.color.accent} opacity={0.055} />
      )}

      {illustration && (
        <IllustrationPanel src={illustration} layout="behind" size={480} />
      )}

      {/* Header */}
      <div
        style={{
          marginBottom: 48,
          opacity: titleOpacity,
          transform: `translateX(${titleX}px)`,
        }}
      >
        {eyebrow && <SectionEyebrow text={eyebrow} />}
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <h1 style={{ ...headlineSpec, color: theme.color.textPrimary, margin: 0, flex: 1 }}>
            {displayTitle}
          </h1>
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
                fontFamily: 'Inter, sans-serif',
                textTransform: 'uppercase' as const,
                letterSpacing: '0.04em',
                flexShrink: 0,
              }}
            >
              {badge}
            </span>
          )}
          {metric && (
            <MetricBadge value={metric} color={theme.color.accent} size="sm" animate />
          )}
        </div>
      </div>

      {/* Points */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, flex: 1 }}>
        {points.map((point, i) => {
          const baseDelay = (a.item.baseDelay as number) ?? 15;
          const interval = a.item.staggerInterval ?? 20;
          const staggerDelay = baseDelay + i * interval;

          const pointSpring = spring({
            frame: Math.max(0, frame - staggerDelay),
            fps,
            config: resolveSpring(a.item.spring),
          });
          const pointOpacity = interpolate(pointSpring, [0, 1], [0, 1]);
          const pointX = interpolate(pointSpring, [0, 1], [a.item.distance?.x ?? -50, 0]);
          const itemScale = a.item.scale ?? [0.95, 1];
          const pointScale = interpolate(pointSpring, [0, 1], itemScale);

          const checkDelay = staggerDelay + (a.check.delay ?? 8);
          const checkFade = a.check.fadeDuration ?? 10;
          const checkOpacity = interpolate(
            frame,
            [checkDelay, checkDelay + checkFade],
            [0, 1],
            { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
          );

          return (
            <div
              key={i}
              style={{
                opacity: pointOpacity,
                transform: `translateX(${pointX}px) scale(${pointScale})`,
              }}
            >
              <InfographicPanel
                variant="strong"
                style={{
                  padding: '18px 28px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 22,
                }}
              >
                {/* Number badge */}
                <div
                  style={{
                    minWidth: 52,
                    height: 52,
                    borderRadius: theme.radius.card,
                    background: theme.infographic.metricBg,
                    border: `2px solid ${theme.color.accent}30`,
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    fontSize: 24,
                    fontWeight: 800,
                    color: theme.color.accent,
                    fontFamily: 'Inter, sans-serif',
                    flexShrink: 0,
                    opacity: 0.5 + checkOpacity * 0.5,
                    boxShadow: theme.elevation.subtle,
                  }}
                >
                  {i + 1}
                </div>
                <span
                  style={{
                    fontSize: 36,
                    lineHeight: 1.5,
                    fontWeight: 500,
                    color: theme.color.textPrimary,
                  }}
                >
                  {point}
                </span>
              </InfographicPanel>
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
          }}
        >
          {caption && (
            <p style={{ ...captionSpec, color: theme.color.textMuted, margin: 0 }}>{caption}</p>
          )}
          {footnote && (
            <p style={{ fontSize: 18, color: theme.color.textMuted, margin: '8px 0 0', fontStyle: 'italic' }}>
              {footnote}
            </p>
          )}
        </div>
      )}
    </AbsoluteFill>
  );
};
