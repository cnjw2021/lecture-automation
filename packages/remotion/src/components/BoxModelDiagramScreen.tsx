import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { theme, typographyStyle } from '../theme';
import { DecorativeBackdrop, InfographicPanel } from './shared';
import { BoxModelCallouts } from './box-model/BoxModelCallouts';
import { BoxModelFormula } from './box-model/BoxModelFormula';
import { BoxModelHeader } from './box-model/BoxModelHeader';
import { BoxModelLayerDiagram } from './box-model/BoxModelLayerDiagram';
import { calloutsFromLayers, layerMapFrom } from './box-model/model';
import type { BoxModelDiagramScreenProps } from './box-model/types';

export const BoxModelDiagramScreen: React.FC<BoxModelDiagramScreenProps> = ({
  title,
  subtitle,
  eyebrow,
  badge,
  metric,
  caption,
  footnote,
  backdropVariant = 'grid',
  contentLabel = 'コンテント',
  contentDetail = '実際の中身',
  highlightLayer,
  layers,
  callouts,
  formula,
  totalLabel,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const captionSpec = typographyStyle('caption');
  const layerByKey = layerMapFrom(layers);
  const resolvedCallouts = callouts ?? calloutsFromLayers(layerByKey);

  const titleSpring = spring({ frame, fps, config: { damping: 18, stiffness: 130, mass: 0.7 } });
  const titleOpacity = interpolate(titleSpring, [0, 1], [0, 1]);
  const titleY = interpolate(titleSpring, [0, 1], [24, 0]);

  const diagramSpring = spring({
    frame: Math.max(0, frame - 8),
    fps,
    config: { damping: 20, stiffness: 120, mass: 0.8 },
  });
  const diagramScale = interpolate(diagramSpring, [0, 1], [0.96, 1]);
  const diagramOpacity = interpolate(diagramSpring, [0, 1], [0, 1]);

  return (
    <AbsoluteFill
      style={{
        background: theme.bg.primary,
        color: theme.color.textPrimary,
        overflow: 'hidden',
        padding: '54px 86px 62px',
      }}
    >
      {backdropVariant && (
        <DecorativeBackdrop variant={backdropVariant} color={theme.color.accent} opacity={0.045} />
      )}

      <BoxModelHeader
        titleOpacity={titleOpacity}
        titleY={titleY}
        title={title}
        subtitle={subtitle}
        eyebrow={eyebrow}
        badge={badge}
        metric={metric}
      />

      <div style={{ display: 'grid', gridTemplateColumns: '1.35fr 0.95fr', gap: 30, flex: 1 }}>
        <InfographicPanel
          variant="floating"
          style={{
            position: 'relative',
            minHeight: 642,
            padding: 28,
            opacity: diagramOpacity,
            transform: `scale(${diagramScale})`,
          }}
        >
          <BoxModelLayerDiagram
            frame={frame}
            fps={fps}
            layerByKey={layerByKey}
            highlightLayer={highlightLayer}
            contentLabel={contentLabel}
            contentDetail={contentDetail}
          />
          <BoxModelFormula formula={formula} totalLabel={totalLabel} />
        </InfographicPanel>

        <BoxModelCallouts frame={frame} fps={fps} callouts={resolvedCallouts} />
      </div>

      {(caption || footnote) && (
        <div
          style={{
            position: 'absolute',
            left: 86,
            right: 86,
            bottom: 28,
            display: 'flex',
            justifyContent: 'space-between',
            gap: 20,
            color: theme.color.textMuted,
            ...captionSpec,
          }}
        >
          <span>{caption}</span>
          <span>{footnote}</span>
        </div>
      )}
    </AbsoluteFill>
  );
};
