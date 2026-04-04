import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';
import { theme } from '../theme';
import { NodeIcon } from './NodeIcon';
import { getAnimConfig, resolveSpring } from '../animation';
import type { ElementAnim } from '../animation';

interface HierarchyNode {
  label: string;
  icon?: string;
  children?: HierarchyNode[];
}

interface HierarchyScreenProps {
  title?: string;
  root: HierarchyNode;
  animation?: Record<string, Partial<ElementAnim>>;
}

interface HierarchyScreenAnim {
  title: ElementAnim;
  node: ElementAnim;
}

export const HierarchyScreen: React.FC<HierarchyScreenProps> = ({ title, root, animation }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const a = getAnimConfig<HierarchyScreenAnim>('HierarchyScreen', animation);

  const titleSpring = spring({ frame, fps, config: resolveSpring(a.title?.spring) });
  const titleOpacity = interpolate(titleSpring, [0, 1], [0, 1]);

  const baseDelay = (a.node?.baseDelay as number) ?? 8;
  const interval = a.node?.staggerInterval ?? 10;

  let nodeIndex = 0;

  const renderNode = (node: HierarchyNode, depth: number, isLast: boolean): React.ReactNode => {
    const currentIndex = nodeIndex++;
    const nodeDelay = baseDelay + currentIndex * interval;
    const nodeSpring = spring({ frame: Math.max(0, frame - nodeDelay), fps, config: resolveSpring(a.node?.spring) });
    const nodeOpacity = interpolate(nodeSpring, [0, 1], [0, 1]);
    const nodeScale = interpolate(nodeSpring, [0, 1], [0.9, 1]);

    const isRoot = depth === 0;
    const hasChildren = node.children && node.children.length > 0;

    return (
      <div key={`${depth}-${currentIndex}`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        {/* Node card */}
        <div
          style={{
            padding: isRoot ? '20px 40px' : '14px 28px',
            borderRadius: 16,
            background: isRoot ? theme.color.accentMuted : theme.color.nodeBackground,
            border: isRoot
              ? `2px solid ${theme.color.surfaceBorder}`
              : `1px solid ${theme.color.divider}`,
            boxShadow: isRoot ? theme.color.nodeShadow : 'none',
            opacity: nodeOpacity,
            transform: `scale(${nodeScale})`,
            display: 'flex',
            alignItems: 'center',
            gap: 14,
          }}
        >
          {node.icon && <NodeIcon icon={node.icon} size={isRoot ? 36 : 28} />}
          <span
            style={{
              fontSize: isRoot ? 32 : 26,
              fontWeight: isRoot ? 700 : 600,
              color: theme.color.textPrimary,
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
                height: 32,
                background: theme.color.accent,
                opacity: nodeOpacity * 0.3,
              }}
            />

            {/* Horizontal bar */}
            {node.children!.length > 1 && (
              <div
                style={{
                  height: 2,
                  background: theme.color.accent,
                  opacity: nodeOpacity * 0.3,
                  alignSelf: 'stretch',
                  marginLeft: `${100 / (node.children!.length * 2)}%`,
                  marginRight: `${100 / (node.children!.length * 2)}%`,
                }}
              />
            )}

            {/* Children row */}
            <div style={{ display: 'flex', gap: 24, justifyContent: 'center', width: '100%' }}>
              {node.children!.map((child, ci) => (
                <div key={ci} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
                  {/* Vertical connector from bar to child */}
                  <div style={{ width: 2, height: 28, background: theme.color.accent, opacity: nodeOpacity * 0.3 }} />
                  {renderNode(child, depth + 1, ci === node.children!.length - 1)}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    );
  };

  return (
    <AbsoluteFill style={{ background: theme.bg.primary, padding: '70px 80px' }}>
      {title && (
        <h1 style={{ fontSize: 52, fontWeight: 800, color: theme.color.textPrimary, opacity: titleOpacity, textAlign: 'center', marginBottom: 48 }}>
          {title}
        </h1>
      )}

      <div style={{ display: 'flex', justifyContent: 'center', flex: 1, alignItems: 'flex-start' }}>
        {renderNode(root, 0, true)}
      </div>
    </AbsoluteFill>
  );
};
