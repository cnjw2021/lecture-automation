import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';
import { theme } from '../theme';
import { NodeIcon } from './NodeIcon';
import { getAnimConfig, resolveSpring } from '../animation';
import type { ElementAnim } from '../animation';

interface Feature {
  icon?: string;
  title: string;
  description?: string;
  color?: string;
}

interface FeatureGridScreenProps {
  title?: string;
  features: Feature[];
  columns?: 2 | 3;
  animation?: Record<string, Partial<ElementAnim>>;
}

interface FeatureGridScreenAnim {
  title: ElementAnim;
  card: ElementAnim;
}

export const FeatureGridScreen: React.FC<FeatureGridScreenProps> = ({
  title,
  features,
  columns = 2,
  animation,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const a = getAnimConfig<FeatureGridScreenAnim>('FeatureGridScreen', animation);

  // Title
  const titleSpring = spring({
    frame,
    fps,
    config: resolveSpring(a.title?.spring),
  });
  const titleOpacity = interpolate(titleSpring, [0, 1], [0, 1]);
  const titleY = interpolate(titleSpring, [0, 1], [a.title?.distance?.y ?? 30, 0]);

  const baseDelay = (a.card?.baseDelay as number) ?? 10;
  const interval = a.card?.staggerInterval ?? 10;

  const cols = columns;
  const gap = cols === 3 ? 28 : 36;
  const sidePad = cols === 3 ? 100 : 140;

  return (
    <AbsoluteFill
      style={{
        background: theme.bg.primary,
        padding: `80px ${sidePad}px`,
      }}
    >
      {/* Title */}
      {title && (
        <h1
          style={{
            fontSize: 52,
            fontWeight: 800,
            color: theme.color.textPrimary,
            textAlign: 'center',
            opacity: titleOpacity,
            transform: `translateY(${titleY}px)`,
            marginBottom: 52,
          }}
        >
          {title}
        </h1>
      )}

      {/* Grid */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap,
          justifyContent: 'center',
        }}
      >
        {features.map((feature, i) => {
          const cardDelay = baseDelay + i * interval;
          const cardSpring = spring({
            frame: Math.max(0, frame - cardDelay),
            fps,
            config: resolveSpring(a.card?.spring),
          });
          const cardOpacity = interpolate(cardSpring, [0, 1], [0, 1]);
          const cardY = interpolate(cardSpring, [0, 1], [40, 0]);
          const cardScale = interpolate(cardSpring, [0, 1], [0.92, 1]);
          const cardColor = feature.color || theme.color.accent;

          const cardWidth = cols === 3
            ? `calc(${100 / 3}% - ${(gap * 2) / 3}px)`
            : `calc(50% - ${gap / 2}px)`;

          return (
            <div
              key={i}
              style={{
                width: cardWidth,
                padding: cols === 3 ? '32px 28px' : '40px 36px',
                background: theme.color.nodeBackground,
                borderRadius: 20,
                borderTop: `4px solid ${cardColor}`,
                boxShadow: theme.color.nodeShadow,
                opacity: cardOpacity,
                transform: `translateY(${cardY}px) scale(${cardScale})`,
                display: 'flex',
                flexDirection: 'column',
                gap: 16,
              }}
            >
              {/* Icon circle */}
              {feature.icon && (
                <div
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: '50%',
                    background: `${cardColor}15`,
                    border: `1.5px solid ${cardColor}25`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 4,
                  }}
                >
                  <NodeIcon icon={feature.icon} size={36} />
                </div>
              )}

              {/* Title */}
              <h3
                style={{
                  fontSize: cols === 3 ? 28 : 32,
                  fontWeight: 700,
                  color: theme.color.textPrimary,
                  lineHeight: 1.3,
                  margin: 0,
                }}
              >
                {feature.title}
              </h3>

              {/* Description */}
              {feature.description && (
                <p
                  style={{
                    fontSize: cols === 3 ? 20 : 24,
                    color: theme.color.textSecondary,
                    lineHeight: 1.6,
                    margin: 0,
                  }}
                >
                  {feature.description}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
