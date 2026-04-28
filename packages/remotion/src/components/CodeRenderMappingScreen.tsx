import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';
import { theme, typographyStyle } from '../theme';
import { getAnimConfig, resolveSpring } from '../animation';
import type { ElementAnim } from '../animation';
import { SectionEyebrow, MetricBadge, DecorativeBackdrop } from './shared';
import type { BackdropVariant } from './shared';

interface CodeRenderMapping {
  lineRange: [number, number];
  target: string;
  label: string;
  color?: string;
}

interface CodeRenderResult {
  url?: string;
  html?: string;
  imageSrc?: string;
}

interface CodeRenderMappingScreenProps {
  code: string;
  language?: string;
  result: CodeRenderResult;
  mappings: CodeRenderMapping[];
  title?: string;
  highlightLines?: number[];
  caption?: string;
  eyebrow?: string;
  badge?: string;
  metric?: string;
  backdropVariant?: BackdropVariant;
  subtitle?: string;
  footnote?: string;
  animation?: Record<string, Partial<ElementAnim>>;
}

interface CodeRenderMappingAnim {
  title: ElementAnim;
  code: ElementAnim;
  result: ElementAnim;
  mapping: ElementAnim;
}

export const CodeRenderMappingScreen: React.FC<CodeRenderMappingScreenProps> = ({
  code,
  result,
  mappings,
  title,
  highlightLines = [],
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
  const a = getAnimConfig<CodeRenderMappingAnim>('CodeRenderMappingScreen', animation);

  const titleSpring = spring({ frame, fps, config: resolveSpring(a.title?.spring) });
  const titleOpacity = interpolate(titleSpring, [0, 1], [0, 1]);

  const codeDelay = a.code?.delay ?? 8;
  const codeSpring = spring({ frame: Math.max(0, frame - codeDelay), fps, config: resolveSpring(a.code?.spring) });
  const codeOpacity = interpolate(codeSpring, [0, 1], [0, 1]);
  const codeX = interpolate(codeSpring, [0, 1], [-40, 0]);

  const resultDelay = a.result?.delay ?? 16;
  const resultSpring = spring({ frame: Math.max(0, frame - resultDelay), fps, config: resolveSpring(a.result?.spring) });
  const resultOpacity = interpolate(resultSpring, [0, 1], [0, 1]);
  const resultX = interpolate(resultSpring, [0, 1], [40, 0]);

  const mappingBaseDelay = (a.mapping?.baseDelay as number) ?? 28;
  const mappingInterval = a.mapping?.staggerInterval ?? 8;

  const headlineSpec = typographyStyle('headline');
  const captionSpec = typographyStyle('caption');
  const hasHeader = !!(eyebrow || title || badge || metric || subtitle);

  const lines = code.split('\n');

  const renderResultBlock = () => {
    if (result.imageSrc) {
      return (
        <img
          src={result.imageSrc}
          alt={title || 'render result'}
          style={{ width: '100%', height: '100%', objectFit: 'contain' }}
        />
      );
    }
    if (result.html) {
      return (
        <div
          style={{
            width: '100%',
            height: '100%',
            background: '#fff',
            padding: '24px',
            borderRadius: 12,
            overflow: 'hidden',
            fontFamily: theme.font.base,
            fontSize: 22,
            color: theme.color.textPrimary,
            lineHeight: 1.6,
          }}
          dangerouslySetInnerHTML={{ __html: result.html }}
        />
      );
    }
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: theme.color.textMuted, fontSize: 22 }}>
        (no result)
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
        <div style={{ textAlign: 'center', opacity: titleOpacity, marginBottom: 24 }}>
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

      {/* Two-column: code | result */}
      <div style={{ display: 'flex', gap: 32, flex: 1, minHeight: 0 }}>
        {/* Code panel */}
        <div
          style={{
            flex: 1,
            background: theme.bg.code,
            border: `1px solid ${theme.color.divider}`,
            borderRadius: 18,
            padding: '32px 36px',
            opacity: codeOpacity,
            transform: `translateX(${codeX}px)`,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            boxShadow: theme.elevation.subtle,
          }}
        >
          <div style={{ fontFamily: "'SF Mono', 'Fira Code', 'Consolas', monospace" }}>
            {lines.map((line, i) => {
              const lineNum = i + 1;
              const inMapping = mappings.find(m => lineNum >= m.lineRange[0] && lineNum <= m.lineRange[1]);
              const isHighlighted = highlightLines.includes(lineNum) || !!inMapping;
              const lineColor = inMapping?.color || theme.color.accent;
              return (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '4px 12px',
                    marginLeft: -12,
                    marginRight: -12,
                    borderRadius: 6,
                    background: isHighlighted ? `${lineColor}14` : 'transparent',
                    borderLeft: isHighlighted ? `3px solid ${lineColor}` : '3px solid transparent',
                  }}
                >
                  <span style={{ width: 40, fontSize: 20, color: theme.color.textMuted, textAlign: 'right', marginRight: 16, fontVariantNumeric: 'tabular-nums', userSelect: 'none' }}>
                    {lineNum}
                  </span>
                  <span style={{ fontSize: 24, color: isHighlighted ? theme.color.textPrimary : theme.color.textSecondary, fontWeight: isHighlighted ? 600 : 400, whiteSpace: 'pre', lineHeight: 1.65 }}>
                    {line || ' '}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Result panel */}
        <div
          style={{
            flex: 1,
            background: theme.infographic.panelBg,
            border: `1px solid ${theme.infographic.panelBorder}`,
            borderRadius: 18,
            padding: '24px',
            opacity: resultOpacity,
            transform: `translateX(${resultX}px)`,
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: theme.elevation.subtle,
          }}
        >
          {/* URL bar */}
          {result.url && (
            <div
              style={{
                fontSize: 16,
                color: theme.color.textMuted,
                fontFamily: theme.font.numeric,
                padding: '6px 14px',
                marginBottom: 14,
                borderRadius: 8,
                background: theme.infographic.panelBgStrong,
                border: `1px solid ${theme.infographic.panelBorder}`,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {result.url}
            </div>
          )}
          <div style={{ flex: 1 }}>{renderResultBlock()}</div>
        </div>
      </div>

      {/* Mappings legend */}
      {mappings.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginTop: 24, justifyContent: 'center' }}>
          {mappings.map((m, i) => {
            const mDelay = mappingBaseDelay + i * mappingInterval;
            const mSpring = spring({ frame: Math.max(0, frame - mDelay), fps, config: resolveSpring(a.mapping?.spring) });
            const mOpacity = interpolate(mSpring, [0, 1], [0, 1]);
            const mY = interpolate(mSpring, [0, 1], [16, 0]);
            const c = m.color || theme.color.accent;
            return (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '8px 18px',
                  borderRadius: theme.radius.pill,
                  background: theme.infographic.panelBg,
                  border: `1.5px solid ${c}`,
                  opacity: mOpacity,
                  transform: `translateY(${mY}px)`,
                  boxShadow: theme.elevation.subtle,
                }}
              >
                <span style={{ fontSize: 14, fontWeight: 700, color: c, fontFamily: theme.font.numeric }}>
                  L{m.lineRange[0]}{m.lineRange[0] !== m.lineRange[1] ? `-${m.lineRange[1]}` : ''}
                </span>
                <span style={{ fontSize: 18, color: theme.color.textPrimary, fontWeight: 500 }}>→</span>
                <span style={{ fontSize: 18, fontWeight: 600, color: theme.color.textPrimary }}>{m.label}</span>
              </div>
            );
          })}
        </div>
      )}

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
