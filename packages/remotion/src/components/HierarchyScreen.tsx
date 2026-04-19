import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';
import { theme, typographyStyle } from '../theme';
import { NodeIcon } from './NodeIcon';
import { getAnimConfig, resolveSpring } from '../animation';
import type { ElementAnim } from '../animation';
import { SectionEyebrow, MetricBadge, DecorativeBackdrop } from './shared';
import type { BackdropVariant } from './shared';

interface HierarchyNode {
  label: string;
  icon?: string;
  children?: HierarchyNode[];
}

interface HierarchyScreenProps {
  title?: string;
  root: HierarchyNode;
  eyebrow?: string;
  badge?: string;
  metric?: string;
  caption?: string;
  backdropVariant?: BackdropVariant;
  subtitle?: string;
  footnote?: string;
  animation?: Record<string, Partial<ElementAnim>>;
}

interface HierarchyScreenAnim {
  title: ElementAnim;
  node: ElementAnim;
}

export const HierarchyScreen: React.FC<HierarchyScreenProps> = ({
  title,
  root,
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
  const a = getAnimConfig<HierarchyScreenAnim>('HierarchyScreen', animation);

  const titleSpring = spring({ frame, fps, config: resolveSpring(a.title?.spring) });
  const titleOpacity = interpolate(titleSpring, [0, 1], [0, 1]);

  const baseDelay = (a.node?.baseDelay as number) ?? 8;
  const interval = a.node?.staggerInterval ?? 10;

  let nodeIndex = 0;

  const headlineSpec = typographyStyle('headline');
  const captionSpec = typographyStyle('caption');
  const hasHeader = !!(eyebrow || title || badge || metric || subtitle);

  const renderNode = (node: HierarchyNode, depth: number): React.ReactNode => {
    const currentIndex = nodeIndex++;
    const nodeDelay = baseDelay + currentIndex * interval;
    const nodeSpring = spring({ frame: Math.max(0, frame - nodeDelay), fps, config: resolveSpring(a.node?.spring) });
    const nodeOpacity = interpolate(nodeSpring, [0, 1], [0, 1]);
    const nodeScale = interpolate(nodeSpring, [0, 1], [0.9, 1]);

    const isRoot = depth === 0;
    const hasChildren = node.children && node.children.length > 0;
    const nodeColor = isRoot ? theme.color.accent : theme.color.accentSecondary;

    return (
      <div key={`${depth}-${currentIndex}`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        {/* Node card */}
        <div
          style={{
            padding: isRoot ? '18px 36px' : '12px 24px',
            borderRadius: theme.radius.card,
            background: isRoot
              ? `linear-gradient(135deg, ${nodeColor}1a 0%, ${theme.infographic.panelBgStrong} 100%)`
              : theme.infographic.panelBgStrong,
            border: `1px solid ${nodeColor}${isRoot ? '44' : '28'}`,
            borderTop: `${isRoot ? 3 : 2}px solid ${nodeColor}`,
            boxShadow: isRoot ? theme.elevation.raised : theme.elevation.subtle,
            opacity: nodeOpacity,
            transform: `scale(${nodeScale})`,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          {node.icon && (
            <div
              style={{
                width: isRoot ? 44 : 34,
                height: isRoot ? 44 : 34,
                borderRadius: isRoot ? theme.radius.card : '50%',
                background: `${nodeColor}18`,
                border: `1.5px solid ${nodeColor}28`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <NodeIcon icon={node.icon} size={isRoot ? 28 : 20} variant="lucide-accent" color={nodeColor} />
            </div>
          )}
          <span
            style={{
              fontSize: isRoot ? 30 : 24,
              fontWeight: isRoot ? 700 : 600,
              color: theme.color.textPrimary,
              fontFamily: theme.font.base,
              lineHeight: 1.3,
            }}
          >
            {node.label}
          </span>
        </div>

        {/* Connector + Children */}
        {hasChildren && (
          <>
            {/* Vertical connector */}
            <div
              style={{
                width: 2,
                height: 28,
                background: `linear-gradient(to bottom, ${nodeColor}60, ${nodeColor}20)`,
                borderRadius: 1,
              }}
            />

            {/* Horizontal bar */}
            {node.children!.length > 1 && (
              <div
                style={{
                  height: 2,
                  background: `linear-gradient(to right, transparent, ${nodeColor}30, transparent)`,
                  alignSelf: 'stretch',
                  marginLeft: `${100 / (node.children!.length * 2)}%`,
                  marginRight: `${100 / (node.children!.length * 2)}%`,
                  borderRadius: 1,
                }}
              />
            )}

            {/* Children row */}
            <div style={{ display: 'flex', gap: 20, justifyContent: 'center', width: '100%' }}>
              {node.children!.map((child, ci) => (
                <div key={ci} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
                  <div
                    style={{
                      width: 2,
                      height: 24,
                      background: `${nodeColor}30`,
                      borderRadius: 1,
                    }}
                  />
                  {renderNode(child, depth + 1)}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    );
  };

  return (
    <AbsoluteFill
      style={{ background: theme.bg.primary, padding: '60px 80px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
    >
      {backdropVariant && (
        <DecorativeBackdrop variant={backdropVariant} color={theme.color.accent} opacity={0.05} />
      )}

      {/* Header */}
      {hasHeader && (
        <div style={{ textAlign: 'center', opacity: titleOpacity, marginBottom: 32 }}>
          {eyebrow && <SectionEyebrow text={eyebrow} style={{ textAlign: 'center' }} />}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
            {title && (
              <h1 style={{ ...headlineSpec, color: theme.color.textPrimary, margin: 0 }}>{title}</h1>
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
            <p style={{ ...captionSpec, color: theme.color.textSecondary, marginTop: 8, fontWeight: 400 }}>
              {subtitle}
            </p>
          )}
        </div>
      )}

      {/* Fallback title */}
      {!hasHeader && title && (
        <h1 style={{ ...headlineSpec, color: theme.color.textPrimary, opacity: titleOpacity, textAlign: 'center', marginBottom: 32 }}>
          {title}
        </h1>
      )}

      <div style={{ display: 'flex', justifyContent: 'center', flex: 1, alignItems: 'flex-start' }}>
        {renderNode(root, 0)}
      </div>

      {/* Caption / Footnote */}
      {(caption || footnote) && (
        <div
          style={{
            marginTop: 16,
            opacity: titleOpacity,
            borderTop: `1px solid ${theme.infographic.panelBorder}`,
            paddingTop: 12,
            textAlign: 'center',
          }}
        >
          {caption && (
            <p style={{ ...captionSpec, color: theme.color.textMuted, margin: 0 }}>{caption}</p>
          )}
          {footnote && (
            <p style={{ fontSize: 18, color: theme.color.textMuted, margin: '6px 0 0', fontStyle: 'italic' }}>
              {footnote}
            </p>
          )}
        </div>
      )}
    </AbsoluteFill>
  );
};
