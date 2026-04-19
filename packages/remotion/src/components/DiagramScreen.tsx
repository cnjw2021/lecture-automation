import { useId } from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';
import { theme, typographyStyle } from '../theme';
import { NodeIcon } from './NodeIcon';
import { getAnimConfig, resolveSpring, type DiagramScreenAnim } from '../animation';
import { SectionEyebrow, MetricBadge, DecorativeBackdrop } from './shared';
import type { BackdropVariant } from './shared';

interface DiagramNode {
  id: string;
  label: string;
  x: number;
  y: number;
  color?: string;
  icon?: string;
  emphasis?: boolean;
}

interface DiagramEdge {
  from: string;
  to: string;
  label?: string;
}

interface DiagramScreenProps {
  title?: string;
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  eyebrow?: string;
  badge?: string;
  metric?: string;
  caption?: string;
  backdropVariant?: BackdropVariant;
  subtitle?: string;
  footnote?: string;
  animation?: Partial<Record<keyof DiagramScreenAnim, Record<string, unknown>>>;
}

const NODE_MIN_WIDTH = 220;
const NODE_CHAR_WIDTH = 26;
const NODE_PADDING_X = 64;
const NODE_HEIGHT = 148;
const ICON_BG_SIZE = 68;
const ICON_SIZE = 44;

const getNodeWidth = (label: string): number =>
  Math.max(NODE_MIN_WIDTH, label.length * NODE_CHAR_WIDTH + NODE_PADDING_X);

export const DiagramScreen: React.FC<DiagramScreenProps> = ({
  title,
  nodes,
  edges,
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
  const a = getAnimConfig<DiagramScreenAnim>('DiagramScreen', animation);
  const arrowId = useId();

  const titleSpring = spring({ frame, fps, config: resolveSpring(a.title.spring) });
  const titleOpacity = interpolate(titleSpring, [0, 1], [0, 1]);
  const titleY = interpolate(titleSpring, [0, 1], [a.title.distance?.y ?? 30, 0]);

  const nodeBaseDelay = (a.node.baseDelay as number) ?? 18;
  const nodeInterval = a.node.staggerInterval ?? 16;
  const edgeExtraDelay = a.edge.extraDelay ?? 10;
  const edgeDrawDuration = a.edge.drawDuration ?? 25;
  const nodeScaleRange = a.node.scale ?? [0, 1];

  const nodeMap = new Map(nodes.map((n) => [n.id, { ...n, width: getNodeWidth(n.label) }]));

  const captionSpec = typographyStyle('caption');
  const headlineSpec = typographyStyle('headline');
  const hasHeader = !!(eyebrow || title || badge || metric || subtitle);
  const topOffset = hasHeader ? 160 : 80;

  return (
    <AbsoluteFill style={{ background: theme.bg.primary, overflow: 'hidden' }}>
      {backdropVariant && (
        <DecorativeBackdrop variant={backdropVariant} color={theme.color.accent} opacity={0.05} />
      )}

      {/* Header */}
      {hasHeader && (
        <div
          style={{
            position: 'absolute',
            top: 44,
            left: 0,
            right: 0,
            textAlign: 'center',
            opacity: titleOpacity,
            transform: `translateY(${titleY}px)`,
            padding: '0 120px',
          }}
        >
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

      {/* Fallback simple title */}
      {!hasHeader && title && (
        <h1
          style={{
            position: 'absolute',
            top: 44,
            left: 0,
            right: 0,
            textAlign: 'center',
            fontSize: 52,
            fontWeight: 800,
            color: theme.color.textPrimary,
            opacity: titleOpacity,
            transform: `translateY(${titleY}px)`,
          }}
        >
          {title}
        </h1>
      )}

      {/* Diagram area */}
      <div
        style={{
          position: 'absolute',
          top: topOffset,
          left: 80,
          right: 80,
          bottom: caption || footnote ? 80 : 60,
        }}
      >
        {/* SVG edges */}
        <svg
          style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', overflow: 'visible' }}
        >
          <defs>
            <marker
              id={`arrowhead-${arrowId}`}
              markerWidth="12"
              markerHeight="8"
              refX="10"
              refY="4"
              orient="auto"
              markerUnits="userSpaceOnUse"
            >
              <path d="M 0 0 L 12 4 L 0 8 L 3 4 Z" fill={theme.infographic.connector} opacity={0.8} />
            </marker>
          </defs>

          {edges.map((edge, i) => {
            const fromNode = nodeMap.get(edge.from);
            const toNode = nodeMap.get(edge.to);
            if (!fromNode || !toNode) return null;

            const fromIndex = nodes.findIndex((n) => n.id === edge.from);
            const edgeDelay = nodeBaseDelay + fromIndex * nodeInterval + edgeExtraDelay;
            const edgeProgress = interpolate(
              frame,
              [edgeDelay, edgeDelay + edgeDrawDuration],
              [0, 1],
              { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
            );

            const x1 = fromNode.x;
            const y1 = fromNode.y;
            const x2 = toNode.x;
            const y2 = toNode.y;

            const dx = x2 - x1;
            const dy = y2 - y1;
            const len = Math.sqrt(dx * dx + dy * dy);
            const ux = dx / len;
            const uy = dy / len;

            const fromWidth = (fromNode.width || NODE_MIN_WIDTH) / 2 + 10;
            const toWidth = (toNode.width || NODE_MIN_WIDTH) / 2 + 10;
            const sx = x1 + ux * fromWidth;
            const sy = y1 + uy * fromWidth;
            const ex = x2 - ux * toWidth;
            const ey = y2 - uy * toWidth;

            const perpX = -uy;
            const perpY = ux;
            const curvature = Math.min(len * 0.12, 40);
            const cpX = (sx + ex) / 2 + perpX * curvature;
            const cpY = (sy + ey) / 2 + perpY * curvature;
            const labelX = (sx + 2 * cpX + ex) / 4;
            const labelY = (sy + 2 * cpY + ey) / 4 - 18;

            const pathD = `M ${sx} ${sy} Q ${cpX} ${cpY} ${ex} ${ey}`;
            const approxLen = len * 0.9;
            const dashOffset = approxLen * (1 - edgeProgress);

            return (
              <g
                key={i}
                opacity={interpolate(edgeProgress, [0, 0.05], [0, 1], { extrapolateRight: 'clamp' })}
              >
                <path
                  d={pathD}
                  fill="none"
                  stroke={theme.color.edgeShadow}
                  strokeWidth={7}
                  strokeLinecap="round"
                />
                <path
                  d={pathD}
                  fill="none"
                  stroke={theme.infographic.connector}
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  strokeDasharray={approxLen}
                  strokeDashoffset={dashOffset}
                  opacity={0.75}
                  markerEnd={`url(#arrowhead-${arrowId})`}
                />

                {edge.label && edgeProgress > 0.5 && (
                  <g
                    opacity={interpolate(edgeProgress, [0.5, 0.8], [0, 1], {
                      extrapolateLeft: 'clamp',
                      extrapolateRight: 'clamp',
                    })}
                  >
                    <rect
                      x={labelX - edge.label.length * 7 - 10}
                      y={labelY - 16}
                      width={edge.label.length * 14 + 20}
                      height={30}
                      rx={8}
                      fill={theme.color.edgeLabelBg}
                      stroke={theme.color.edgeLabelBorder}
                      strokeWidth={1}
                    />
                    <text
                      x={labelX}
                      y={labelY + 4}
                      textAnchor="middle"
                      fill={theme.infographic.connector}
                      fontSize={17}
                      fontWeight={600}
                      fontFamily={theme.font.numeric}
                    >
                      {edge.label}
                    </text>
                  </g>
                )}
              </g>
            );
          })}
        </svg>

        {/* Nodes */}
        {nodes.map((node, i) => {
          const nodeDelay = nodeBaseDelay + i * nodeInterval;
          const nodeSpring = spring({
            frame: Math.max(0, frame - nodeDelay),
            fps,
            config: resolveSpring(a.node.spring),
          });
          const nodeScale = interpolate(nodeSpring, [0, 1], nodeScaleRange);
          const nodeOpacity = interpolate(nodeSpring, [0, 1], [0, 1]);
          const nodeColor = node.color || theme.color.accent;
          const nodeWidth = getNodeWidth(node.label);
          const isEmphasis = node.emphasis;
          const iconVariant = isEmphasis ? 'highlighted' : 'lucide-muted';

          return (
            <div
              key={node.id}
              style={{
                position: 'absolute',
                left: node.x - nodeWidth / 2,
                top: node.y - NODE_HEIGHT / 2,
                width: nodeWidth,
                minHeight: NODE_HEIGHT,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                background: isEmphasis
                  ? `linear-gradient(160deg, ${nodeColor}22 0%, ${theme.infographic.panelBgStrong} 100%)`
                  : theme.infographic.panelBgStrong,
                border: `1px solid ${nodeColor}${isEmphasis ? '50' : '28'}`,
                borderTop: `4px solid ${nodeColor}`,
                borderRadius: theme.radius.card,
                padding: '22px 18px 18px',
                opacity: nodeOpacity,
                transform: `scale(${nodeScale})`,
                boxShadow: isEmphasis ? theme.elevation.raised : theme.elevation.subtle,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  top: 10,
                  left: 14,
                  fontSize: 11,
                  fontWeight: 700,
                  color: nodeColor,
                  opacity: 0.7,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase' as const,
                  fontFamily: theme.font.numeric,
                }}
              >
                {i + 1}
              </div>

              {node.icon && (
                <div
                  style={{
                    marginTop: 8,
                    marginBottom: 12,
                    width: ICON_BG_SIZE,
                    height: ICON_BG_SIZE,
                    borderRadius: isEmphasis ? theme.radius.card : '50%',
                    background: isEmphasis ? nodeColor : `${nodeColor}16`,
                    border: `1.5px solid ${isEmphasis ? nodeColor : `${nodeColor}28`}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: isEmphasis ? theme.elevation.raised : theme.elevation.subtle,
                  }}
                >
                  <NodeIcon icon={node.icon} size={ICON_SIZE} variant={iconVariant} color={isEmphasis ? undefined : nodeColor} />
                </div>
              )}

              <span
                style={{
                  fontSize: 23,
                  fontWeight: 700,
                  color: theme.color.textPrimary,
                  textAlign: 'center',
                  lineHeight: 1.35,
                }}
              >
                {node.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Caption / Footnote */}
      {(caption || footnote) && (
        <div
          style={{
            position: 'absolute',
            bottom: 20,
            left: 120,
            right: 120,
            borderTop: `1px solid ${theme.infographic.panelBorder}`,
            paddingTop: 10,
            opacity: titleOpacity,
            textAlign: 'center',
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
