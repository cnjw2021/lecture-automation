import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';
import { theme, typographyStyle } from '../theme';
import { getAnimConfig, resolveSpring } from '../animation';
import type { ElementAnim } from '../animation';
import { SectionEyebrow, MetricBadge, DecorativeBackdrop } from './shared';
import type { BackdropVariant } from './shared';

interface TreeNode {
  id?: string;
  label: string;
  icon?: string;
  children?: TreeNode[];
}

interface RenderRegion {
  id: string;
  label: string;
  description?: string;
}

interface StructureToRenderScreenProps {
  tree: TreeNode;
  rendered: {
    regions: RenderRegion[];
    url?: string;
  };
  title?: string;
  activeId?: string;
  caption?: string;
  eyebrow?: string;
  badge?: string;
  metric?: string;
  backdropVariant?: BackdropVariant;
  subtitle?: string;
  footnote?: string;
  animation?: Record<string, Partial<ElementAnim>>;
}

interface StructureToRenderAnim {
  title: ElementAnim;
  tree: ElementAnim;
  rendered: ElementAnim;
}

export const StructureToRenderScreen: React.FC<StructureToRenderScreenProps> = ({
  tree,
  rendered,
  title,
  activeId,
  caption,
  eyebrow,
  badge,
  metric,
  backdropVariant,
  subtitle,
  footnote,
  animation,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const a = getAnimConfig<StructureToRenderAnim>('StructureToRenderScreen', animation);

  const titleSpring = spring({ frame, fps, config: resolveSpring(a.title?.spring) });
  const titleOpacity = interpolate(titleSpring, [0, 1], [0, 1]);

  const treeDelay = a.tree?.delay ?? 8;
  const treeSpring = spring({ frame: Math.max(0, frame - treeDelay), fps, config: resolveSpring(a.tree?.spring) });
  const treeOpacity = interpolate(treeSpring, [0, 1], [0, 1]);
  const treeX = interpolate(treeSpring, [0, 1], [-40, 0]);

  const renderedDelay = a.rendered?.delay ?? 16;
  const renderedSpring = spring({ frame: Math.max(0, frame - renderedDelay), fps, config: resolveSpring(a.rendered?.spring) });
  const renderedOpacity = interpolate(renderedSpring, [0, 1], [0, 1]);
  const renderedX = interpolate(renderedSpring, [0, 1], [40, 0]);

  const headlineSpec = typographyStyle('headline');
  const captionSpec = typographyStyle('caption');
  const hasHeader = !!(eyebrow || title || badge || metric || subtitle);

  const renderTree = (node: TreeNode, depth: number): React.ReactNode => {
    const isActive = !!node.id && node.id === activeId;
    const indent = depth * 28;
    const c = isActive ? theme.color.accent : theme.color.textSecondary;
    return (
      <div key={`${depth}-${node.id || node.label}`} style={{ marginLeft: indent }}>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 10,
            padding: '6px 14px',
            borderRadius: 8,
            background: isActive ? `${theme.color.accent}1f` : 'transparent',
            border: `1px solid ${isActive ? theme.color.accent : 'transparent'}`,
            margin: '4px 0',
            fontFamily: "'SF Mono', 'Fira Code', 'Consolas', monospace",
            fontSize: 22,
            color: c,
            fontWeight: isActive ? 700 : 500,
          }}
        >
          {node.label}
        </div>
        {node.children && node.children.map((child) => renderTree(child, depth + 1))}
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
        <div style={{ textAlign: 'center', opacity: titleOpacity, marginBottom: 28 }}>
          {eyebrow && <SectionEyebrow text={eyebrow} style={{ textAlign: 'center' }} />}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
            {title && <h1 style={{ ...headlineSpec, color: theme.color.textPrimary, margin: 0 }}>{title}</h1>}
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
            {metric && <MetricBadge value={metric} color={theme.color.accent} size="sm" animate />}
          </div>
          {subtitle && (
            <p style={{ ...captionSpec, color: theme.color.textSecondary, marginTop: 8, fontWeight: 400 }}>
              {subtitle}
            </p>
          )}
        </div>
      )}

      {/* Two columns */}
      <div style={{ display: 'flex', gap: 36, flex: 1, minHeight: 0 }}>
        {/* Tree */}
        <div
          style={{
            flex: 1,
            background: theme.bg.code,
            border: `1px solid ${theme.color.divider}`,
            borderRadius: 18,
            padding: '36px 32px',
            opacity: treeOpacity,
            transform: `translateX(${treeX}px)`,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            boxShadow: theme.elevation.subtle,
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 700, color: theme.color.accent, opacity: 0.6, marginBottom: 12, letterSpacing: '0.08em', textTransform: 'uppercase' as const }}>HTML 構造</div>
          {renderTree(tree, 0)}
        </div>

        {/* Rendered */}
        <div
          style={{
            flex: 1,
            background: theme.infographic.panelBg,
            border: `1px solid ${theme.infographic.panelBorder}`,
            borderRadius: 18,
            padding: '24px',
            opacity: renderedOpacity,
            transform: `translateX(${renderedX}px)`,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            boxShadow: theme.elevation.subtle,
          }}
        >
          {rendered.url && (
            <div
              style={{
                fontSize: 16,
                color: theme.color.textMuted,
                fontFamily: theme.font.numeric,
                padding: '6px 14px',
                borderRadius: 8,
                background: theme.infographic.panelBgStrong,
                border: `1px solid ${theme.infographic.panelBorder}`,
                marginBottom: 8,
              }}
            >
              {rendered.url}
            </div>
          )}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {rendered.regions.map((r) => {
              const isActive = r.id === activeId;
              return (
                <div
                  key={r.id}
                  style={{
                    padding: '18px 24px',
                    borderRadius: 12,
                    background: isActive ? `${theme.color.accent}18` : '#fff',
                    border: `2px ${isActive ? 'solid' : 'dashed'} ${isActive ? theme.color.accent : theme.color.divider}`,
                    boxShadow: isActive ? theme.elevation.raised : 'none',
                  }}
                >
                  <div style={{ fontSize: 22, fontWeight: 700, color: isActive ? theme.color.accent : theme.color.textPrimary, lineHeight: 1.3 }}>
                    {r.label}
                  </div>
                  {r.description && (
                    <div style={{ fontSize: 18, color: theme.color.textSecondary, marginTop: 4 }}>{r.description}</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
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
          {caption && <p style={{ ...captionSpec, color: theme.color.textMuted, margin: 0 }}>{caption}</p>}
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
