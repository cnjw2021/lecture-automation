import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';
import { theme, typographyStyle } from '../theme';
import { NodeIcon } from './NodeIcon';
import { getAnimConfig, resolveSpring } from '../animation';
import type { ElementAnim } from '../animation';
import {
  SectionEyebrow,
  MetricBadge,
  DecorativeBackdrop,
  IllustrationPanel,
} from './shared';
import type { BackdropVariant } from './shared';

type CalloutType = 'tip' | 'warning' | 'info' | 'error';

interface CalloutScreenProps {
  type?: CalloutType;
  title: string;
  body: string;
  icon?: string;
  eyebrow?: string;
  badge?: string;
  metric?: string;
  caption?: string;
  illustration?: string;
  backdropVariant?: BackdropVariant;
  footnote?: string;
  animation?: Record<string, Partial<ElementAnim>>;
}

interface CalloutScreenAnim {
  card: ElementAnim;
  text: ElementAnim;
}

const CALLOUT_STYLES: Record<CalloutType, { color: string; defaultIcon: string; label: string }> = {
  tip: { color: theme.infographic.success, defaultIcon: '💡', label: 'TIP' },
  warning: { color: theme.infographic.warning, defaultIcon: '⚠️', label: 'WARNING' },
  info: { color: '#3b82f6', defaultIcon: 'ℹ️', label: 'INFO' },
  error: { color: theme.infographic.danger, defaultIcon: '🚫', label: 'ERROR' },
};

export const CalloutScreen: React.FC<CalloutScreenProps> = ({
  type = 'tip',
  title,
  body,
  icon,
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
  const a = getAnimConfig<CalloutScreenAnim>('CalloutScreen', animation);

  const callout = CALLOUT_STYLES[type];
  const displayIcon = icon || callout.defaultIcon;

  const cardSpring = spring({ frame, fps, config: resolveSpring(a.card?.spring) });
  const cardOpacity = interpolate(cardSpring, [0, 1], [0, 1]);
  const cardScale = interpolate(cardSpring, [0, 1], [0.92, 1]);

  const txtDelay = a.text?.delay ?? 12;
  const txtSpring = spring({
    frame: Math.max(0, frame - txtDelay),
    fps,
    config: resolveSpring(a.text?.spring),
  });
  const txtOpacity = interpolate(txtSpring, [0, 1], [0, 1]);
  const txtY = interpolate(txtSpring, [0, 1], [20, 0]);

  const titleSpec = typographyStyle('title');
  const bodySpec = typographyStyle('body');
  const captionSpec = typographyStyle('caption');

  return (
    <AbsoluteFill
      style={{
        background: theme.bg.primary,
        justifyContent: 'center',
        alignItems: 'center',
        padding: '0 160px',
        overflow: 'hidden',
      }}
    >
      {backdropVariant && (
        <DecorativeBackdrop variant={backdropVariant} color={callout.color} opacity={0.055} />
      )}

      {/* Ambient glow */}
      <div
        style={{
          position: 'absolute',
          width: 900,
          height: 450,
          borderRadius: '50%',
          background: `radial-gradient(ellipse, ${callout.color}0a 0%, transparent 70%)`,
          pointerEvents: 'none',
        }}
      />

      {illustration && (
        <IllustrationPanel src={illustration} layout="behind" size={480} />
      )}

      <div
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: 1260,
          padding: '56px 64px',
          borderRadius: theme.radius.panel,
          background: theme.infographic.panelBgStrong,
          border: `1px solid ${theme.infographic.panelBorderStrong}`,
          borderLeft: `6px solid ${callout.color}`,
          boxShadow: theme.elevation.floating,
          opacity: cardOpacity,
          transform: `scale(${cardScale})`,
        }}
      >
        {/* Type badge */}
        <div
          style={{
            position: 'absolute',
            top: -14,
            left: 48,
            padding: '4px 18px',
            borderRadius: theme.radius.pill,
            background: callout.color,
            fontSize: 13,
            fontWeight: 800,
            letterSpacing: '0.1em',
            color: '#fff',
            textTransform: 'uppercase' as const,
            fontFamily: 'Inter, sans-serif',
          }}
        >
          {callout.label}
        </div>

        {/* Eyebrow */}
        {eyebrow && (
          <div
            style={{ marginBottom: 12, opacity: txtOpacity, transform: `translateY(${txtY}px)` }}
          >
            <SectionEyebrow text={eyebrow} color={callout.color} />
          </div>
        )}

        {/* Title row: icon + title + badge/metric */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 28,
            marginBottom: 24,
            opacity: cardOpacity,
          }}
        >
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: theme.radius.card,
              background: `${callout.color}18`,
              border: `1.5px solid ${callout.color}30`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              boxShadow: theme.elevation.subtle,
            }}
          >
            <NodeIcon icon={displayIcon} size={40} variant="lucide-accent" color={callout.color} />
          </div>

          <h2 style={{ ...titleSpec, color: theme.color.textPrimary, margin: 0, flex: 1 }}>
            {title}
          </h2>

          {(badge || metric) && (
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexShrink: 0 }}>
              {badge && (
                <span
                  style={{
                    fontSize: 17,
                    fontWeight: 700,
                    color: theme.infographic.badgeText,
                    background: theme.infographic.badgeBg,
                    border: `1px solid ${callout.color}28`,
                    borderRadius: theme.radius.pill,
                    padding: '4px 14px',
                    fontFamily: 'Inter, sans-serif',
                    textTransform: 'uppercase' as const,
                    letterSpacing: '0.04em',
                  }}
                >
                  {badge}
                </span>
              )}
              {metric && <MetricBadge value={metric} color={callout.color} size="sm" />}
            </div>
          )}
        </div>

        {/* Body */}
        <p
          style={{
            ...bodySpec,
            color: theme.color.textSecondary,
            lineHeight: 1.65,
            margin: 0,
            paddingLeft: 100,
            opacity: txtOpacity,
            transform: `translateY(${txtY}px)`,
          }}
        >
          {body}
        </p>

        {/* Caption */}
        {caption && (
          <p
            style={{
              ...captionSpec,
              color: theme.color.textMuted,
              marginTop: 16,
              paddingLeft: 100,
              opacity: txtOpacity,
            }}
          >
            {caption}
          </p>
        )}

        {/* Footnote */}
        {footnote && (
          <p
            style={{
              fontSize: 18,
              color: theme.color.textMuted,
              marginTop: 20,
              borderTop: `1px solid ${theme.infographic.panelBorder}`,
              paddingTop: 16,
              opacity: txtOpacity,
              fontStyle: 'italic',
            }}
          >
            {footnote}
          </p>
        )}
      </div>
    </AbsoluteFill>
  );
};
