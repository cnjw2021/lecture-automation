import { interpolate, spring } from 'remotion';
import { theme } from '../../theme';
import { LAYER_ORDER } from './model';
import { toRgba } from './color';
import type { BoxModelLayerKey, ResolvedBoxModelLayer } from './types';

interface BoxModelLayerDiagramProps {
  frame: number;
  fps: number;
  layerByKey: Record<BoxModelLayerKey, ResolvedBoxModelLayer>;
  highlightLayer?: BoxModelLayerKey;
  contentLabel: string;
  contentDetail: string;
}

const LAYER_LAYOUT: Record<BoxModelLayerKey, React.CSSProperties> = {
  margin: { left: 22, top: 18, width: 790, height: 500 },
  border: { left: 105, top: 96, width: 625, height: 352 },
  padding: { left: 152, top: 138, width: 530, height: 268 },
  content: { left: 236, top: 205, width: 360, height: 132 },
};

const layerBorder = (key: BoxModelLayerKey, color: string): string => {
  if (key === 'margin') return `3px dashed ${color}`;
  if (key === 'border') return `12px solid ${color}`;
  return `2px solid ${color}`;
};

const layerBackground = (key: BoxModelLayerKey, color: string): string => {
  if (key === 'content') return toRgba(color, 0.2);
  if (key === 'margin') {
    return `repeating-linear-gradient(135deg, ${toRgba(color, 0.09)} 0, ${toRgba(color, 0.09)} 14px, transparent 14px, transparent 28px)`;
  }
  return toRgba(color, 0.16);
};

export const BoxModelLayerDiagram: React.FC<BoxModelLayerDiagramProps> = ({
  frame,
  fps,
  layerByKey,
  highlightLayer,
  contentLabel,
  contentDetail,
}) => (
  <div
    style={{
      position: 'relative',
      width: 835,
      height: 540,
      margin: '10px auto 0',
    }}
  >
    {LAYER_ORDER.map((key, index) => {
      const layer = layerByKey[key];
      const isHighlight = highlightLayer === key;
      const layerSpring = spring({
        frame: Math.max(0, frame - 12 - index * 8),
        fps,
        config: { damping: 17, stiffness: 120, mass: 0.7 },
      });
      const opacity = interpolate(layerSpring, [0, 1], [0, isHighlight || !highlightLayer ? 1 : 0.72]);
      const scale = interpolate(layerSpring, [0, 1], [0.98, isHighlight ? 1.015 : 1]);

      return (
        <div
          key={key}
          style={{
            position: 'absolute',
            ...LAYER_LAYOUT[key],
            opacity,
            transform: `scale(${scale})`,
            transformOrigin: 'center',
            borderRadius: key === 'margin' ? 36 : key === 'content' ? 16 : 24,
            border: layerBorder(key, layer.color),
            background: layerBackground(key, layer.color),
            boxShadow: isHighlight
              ? `0 0 0 8px ${toRgba(layer.color, 0.12)}, 0 22px 46px ${toRgba(layer.color, 0.22)}`
              : 'none',
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: key === 'content' ? 16 : 14,
              left: key === 'content' ? 18 : 20,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              background: theme.infographic.panelBgStrong,
              border: `1px solid ${toRgba(layer.color, 0.34)}`,
              borderRadius: theme.radius.pill,
              padding: '7px 13px',
              boxShadow: theme.elevation.subtle,
            }}
          >
            <span
              style={{
                width: 12,
                height: 12,
                borderRadius: '50%',
                background: layer.color,
                flexShrink: 0,
              }}
            />
            <span style={{ fontSize: 19, fontWeight: 800, color: layer.color }}>{layer.label}</span>
            {layer.value && (
              <span
                style={{
                  fontFamily: theme.font.numeric,
                  fontSize: 18,
                  fontWeight: 800,
                  color: theme.color.textSecondary,
                }}
              >
                {layer.value}
              </span>
            )}
          </div>
        </div>
      );
    })}

    <div
      style={{
        position: 'absolute',
        left: 280,
        top: 248,
        width: 272,
        textAlign: 'center',
        color: theme.color.textPrimary,
      }}
    >
      <div style={{ fontSize: 34, fontWeight: 900, lineHeight: 1.2 }}>{contentLabel}</div>
      <div style={{ marginTop: 7, fontSize: 20, color: theme.color.textSecondary }}>{contentDetail}</div>
    </div>
  </div>
);
