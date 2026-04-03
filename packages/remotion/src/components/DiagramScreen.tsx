import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';

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
        background: 'linear-gradient(160deg, #0f0c29 0%, #1a1a2e 50%, #16213e 100%)',
      }}
    >
      {/* Title */}
      {title && (
        <h1
          style={{
            position: 'absolute',
            top: 60,
            left: 0,
            right: 0,
            textAlign: 'center',
            fontSize: 56,
            fontWeight: 800,
            color: '#e2e8f0',
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
          top: title ? 160 : 80,
          left: 120,
          right: 120,
          bottom: 80,
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
          {edges.map((edge, i) => {
            const fromNode = nodeMap.get(edge.from);
            const toNode = nodeMap.get(edge.to);
            if (!fromNode || !toNode) return null;

            // Edge draws in after its source node appears
            const fromIndex = nodes.findIndex((n) => n.id === edge.from);
            const edgeDelay = 15 + fromIndex * 18 + 10;
            const edgeProgress = interpolate(frame, [edgeDelay, edgeDelay + 20], [0, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            });

            const x1 = fromNode.x;
            const y1 = fromNode.y;
            const x2 = toNode.x;
            const y2 = toNode.y;

            // Calculate midpoint for label
            const midX = (x1 + x2) / 2;
            const midY = (y1 + y2) / 2;

            // Arrow path with dashoffset animation
            const dx = x2 - x1;
            const dy = y2 - y1;
            const len = Math.sqrt(dx * dx + dy * dy);
            const ux = dx / len;
            const uy = dy / len;

            // Offset start/end from node centers
            const offset = 70;
            const sx = x1 + ux * offset;
            const sy = y1 + uy * offset;
            const ex = x2 - ux * offset;
            const ey = y2 - uy * offset;

            // Current visible end point
            const cx = sx + (ex - sx) * edgeProgress;
            const cy = sy + (ey - sy) * edgeProgress;

            return (
              <g key={i}>
                {/* Line */}
                <line
                  x1={sx}
                  y1={sy}
                  x2={cx}
                  y2={cy}
                  stroke="rgba(99,102,241,0.6)"
                  strokeWidth={3}
                  strokeLinecap="round"
                />

                {/* Arrowhead (appears at end) */}
                {edgeProgress > 0.9 && (
                  <polygon
                    points={`${ex},${ey} ${ex - ux * 16 + uy * 8},${ey - uy * 16 - ux * 8} ${ex - ux * 16 - uy * 8},${ey - uy * 16 + ux * 8}`}
                    fill="rgba(99,102,241,0.8)"
                    opacity={interpolate(edgeProgress, [0.9, 1], [0, 1])}
                  />
                )}

                {/* Edge label */}
                {edge.label && edgeProgress > 0.5 && (
                  <text
                    x={midX}
                    y={midY - 14}
                    textAnchor="middle"
                    fill="rgba(167,139,250,0.8)"
                    fontSize={22}
                    fontWeight={500}
                    opacity={interpolate(edgeProgress, [0.5, 0.8], [0, 1], {
                      extrapolateLeft: 'clamp',
                      extrapolateRight: 'clamp',
                    })}
                  >
                    {edge.label}
                  </text>
                )}
              </g>
            );
          })}
        </svg>

        {/* Nodes */}
        {nodes.map((node, i) => {
          const nodeDelay = 15 + i * 18;
          const nodeSpring = spring({
            frame: Math.max(0, frame - nodeDelay),
            fps,
            config: { damping: 12, stiffness: 100, mass: 0.6 },
          });
          const nodeScale = interpolate(nodeSpring, [0, 1], [0, 1]);
          const nodeOpacity = interpolate(nodeSpring, [0, 1], [0, 1]);
          const nodeColor = node.color || '#6366f1';

          return (
            <div
              key={node.id}
              style={{
                position: 'absolute',
                left: node.x - 70,
                top: node.y - 40,
                width: 140,
                minHeight: 80,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                background: `${nodeColor}18`,
                border: `2px solid ${nodeColor}55`,
                borderRadius: 16,
                padding: '14px 16px',
                opacity: nodeOpacity,
                transform: `scale(${nodeScale})`,
              }}
            >
              {node.icon && (
                <span style={{ fontSize: 30, marginBottom: 6 }}>{node.icon}</span>
              )}
              <span
                style={{
                  fontSize: 22,
                  fontWeight: 600,
                  color: '#e2e8f0',
                  textAlign: 'center',
                  lineHeight: 1.3,
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
