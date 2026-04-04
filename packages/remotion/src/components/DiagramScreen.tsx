import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';
import { theme } from '../theme';

interface DiagramNode {
  id: string;
  label: string;
  x: number;
  y: number;
  color?: string;
  icon?: string;
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
}

const NODE_WIDTH = 180;
const NODE_HEIGHT = 100;
const EDGE_OFFSET = 95;

export const DiagramScreen: React.FC<DiagramScreenProps> = ({ title, nodes, edges }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Title animation
  const titleSpring = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 80, mass: 0.8 },
  });
  const titleOpacity = interpolate(titleSpring, [0, 1], [0, 1]);
  const titleY = interpolate(titleSpring, [0, 1], [30, 0]);

  // Build node position map for edge drawing
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  return (
    <AbsoluteFill
      style={{
        background: theme.bg.primary,
      }}
    >
      {/* Title */}
      {title && (
        <h1
          style={{
            position: 'absolute',
            top: 56,
            left: 0,
            right: 0,
            textAlign: 'center',
            fontSize: 52,
            fontWeight: 800,
            color: theme.color.textPrimary,
            opacity: titleOpacity,
            transform: `translateY(${titleY}px)`,
            letterSpacing: '0.02em',
          }}
        >
          {title}
        </h1>
      )}

      {/* Diagram area */}
      <div
        style={{
          position: 'absolute',
          top: title ? 160 : 80,
          left: 100,
          right: 100,
          bottom: 60,
        }}
      >
        {/* SVG layer for edges */}
        <svg
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            overflow: 'visible',
          }}
        >
          <defs>
            <marker
              id="arrowhead"
              markerWidth="12"
              markerHeight="8"
              refX="10"
              refY="4"
              orient="auto"
              markerUnits="userSpaceOnUse"
            >
              <path
                d="M 0 0 L 12 4 L 0 8 L 3 4 Z"
                fill={theme.color.accent}
                opacity={0.7}
              />
            </marker>
            <filter id="edgeGlow">
              <feGaussianBlur stdDeviation="2" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          {edges.map((edge, i) => {
            const fromNode = nodeMap.get(edge.from);
            const toNode = nodeMap.get(edge.to);
            if (!fromNode || !toNode) return null;

            // Edge draws in after its source node appears
            const fromIndex = nodes.findIndex((n) => n.id === edge.from);
            const edgeDelay = 18 + fromIndex * 16 + 10;
            const edgeProgress = interpolate(frame, [edgeDelay, edgeDelay + 25], [0, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            });

            const x1 = fromNode.x;
            const y1 = fromNode.y;
            const x2 = toNode.x;
            const y2 = toNode.y;

            const dx = x2 - x1;
            const dy = y2 - y1;
            const len = Math.sqrt(dx * dx + dy * dy);
            const ux = dx / len;
            const uy = dy / len;

            // Offset from node edges
            const sx = x1 + ux * EDGE_OFFSET;
            const sy = y1 + uy * EDGE_OFFSET;
            const ex = x2 - ux * EDGE_OFFSET;
            const ey = y2 - uy * EDGE_OFFSET;

            // Curved path — perpendicular offset for control point
            const perpX = -uy;
            const perpY = ux;
            const curvature = Math.min(len * 0.12, 40);
            const cpX = (sx + ex) / 2 + perpX * curvature;
            const cpY = (sy + ey) / 2 + perpY * curvature;

            // Label position (along curve midpoint, shifted above)
            const labelX = (sx + 2 * cpX + ex) / 4;
            const labelY = (sy + 2 * cpY + ey) / 4 - 18;

            // Animated path using dasharray
            const pathD = `M ${sx} ${sy} Q ${cpX} ${cpY} ${ex} ${ey}`;
            const approxLen = len * 0.9;
            const dashOffset = approxLen * (1 - edgeProgress);

            return (
              <g key={i} opacity={interpolate(edgeProgress, [0, 0.05], [0, 1], { extrapolateRight: 'clamp' })}>
                {/* Shadow line */}
                <path
                  d={pathD}
                  fill="none"
                  stroke="rgba(196,123,90,0.08)"
                  strokeWidth={8}
                  strokeLinecap="round"
                />
                {/* Main line */}
                <path
                  d={pathD}
                  fill="none"
                  stroke={theme.color.accent}
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  strokeDasharray={approxLen}
                  strokeDashoffset={dashOffset}
                  opacity={0.6}
                  markerEnd="url(#arrowhead)"
                />

                {/* Edge label with background */}
                {edge.label && edgeProgress > 0.5 && (
                  <g opacity={interpolate(edgeProgress, [0.5, 0.8], [0, 1], {
                    extrapolateLeft: 'clamp',
                    extrapolateRight: 'clamp',
                  })}>
                    <rect
                      x={labelX - edge.label.length * 7 - 10}
                      y={labelY - 16}
                      width={edge.label.length * 14 + 20}
                      height={30}
                      rx={8}
                      fill="#FDF8F0"
                      stroke="rgba(196,123,90,0.15)"
                      strokeWidth={1}
                    />
                    <text
                      x={labelX}
                      y={labelY + 4}
                      textAnchor="middle"
                      fill={theme.color.accent}
                      fontSize={18}
                      fontWeight={600}
                      fontFamily="system-ui, -apple-system, sans-serif"
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
          const nodeDelay = 18 + i * 16;
          const nodeSpring = spring({
            frame: Math.max(0, frame - nodeDelay),
            fps,
            config: { damping: 12, stiffness: 100, mass: 0.6 },
          });
          const nodeScale = interpolate(nodeSpring, [0, 1], [0, 1]);
          const nodeOpacity = interpolate(nodeSpring, [0, 1], [0, 1]);
          const nodeColor = node.color || theme.color.accent;

          return (
            <div
              key={node.id}
              style={{
                position: 'absolute',
                left: node.x - NODE_WIDTH / 2,
                top: node.y - NODE_HEIGHT / 2,
                width: NODE_WIDTH,
                minHeight: NODE_HEIGHT,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                background: `linear-gradient(145deg, #FFFFFF 0%, #FDF8F0 100%)`,
                border: `1.5px solid ${nodeColor}30`,
                borderRadius: 20,
                padding: '16px 20px',
                opacity: nodeOpacity,
                transform: `scale(${nodeScale})`,
                boxShadow: `0 4px 20px rgba(45,41,38,0.06), 0 1px 4px rgba(45,41,38,0.04), inset 0 1px 0 rgba(255,255,255,0.8)`,
              }}
            >
              {node.icon && (
                <span style={{
                  fontSize: 36,
                  marginBottom: 8,
                  filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))',
                }}>
                  {node.icon}
                </span>
              )}
              <span
                style={{
                  fontSize: 24,
                  fontWeight: 700,
                  color: theme.color.textPrimary,
                  textAlign: 'center',
                  lineHeight: 1.35,
                  letterSpacing: '0.01em',
                }}
              >
                {node.label}
              </span>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
