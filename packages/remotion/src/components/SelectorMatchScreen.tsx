import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';
import { theme, typographyStyle } from '../theme';
import { getAnimConfig, resolveSpring } from '../animation';
import type { ElementAnim } from '../animation';
import { SectionEyebrow, MetricBadge, DecorativeBackdrop } from './shared';
import type { BackdropVariant } from './shared';

interface SelectorToken {
  text: string;
  role: 'tag' | 'class' | 'id' | 'pseudo' | 'attr' | 'combinator' | 'plain';
  color?: string;
}

interface DomNode {
  id?: string;
  label: string;
  matched?: boolean;
  children?: DomNode[];
}

interface SelectorMatchScreenProps {
  selector: string;
  tokens: SelectorToken[];
  dom: DomNode;
  title?: string;
  activeNodeIds?: string[];
  explanation?: string;
  caption?: string;
  eyebrow?: string;
  badge?: string;
  metric?: string;
  backdropVariant?: BackdropVariant;
  subtitle?: string;
  footnote?: string;
  animation?: Record<string, Partial<ElementAnim>>;
}

interface SelectorMatchAnim {
  title: ElementAnim;
  selector: ElementAnim;
  dom: ElementAnim;
}

const ROLE_COLORS: Record<SelectorToken['role'], string> = {
  tag: '#3b82f6',
  class: '#10b981',
  id: '#f59e0b',
  pseudo: '#a855f7',
  attr: '#ef4444',
  combinator: '#94a3b8',
  plain: '#94a3b8',
};

export const SelectorMatchScreen: React.FC<SelectorMatchScreenProps> = ({
  selector,
  tokens,
  dom,
  title,
  activeNodeIds = [],
  explanation,
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
  const a = getAnimConfig<SelectorMatchAnim>('SelectorMatchScreen', animation);

  const titleSpring = spring({ frame, fps, config: resolveSpring(a.title?.spring) });
  const titleOpacity = interpolate(titleSpring, [0, 1], [0, 1]);

  const selDelay = a.selector?.delay ?? 8;
  const selSpring = spring({ frame: Math.max(0, frame - selDelay), fps, config: resolveSpring(a.selector?.spring) });
  const selOpacity = interpolate(selSpring, [0, 1], [0, 1]);
  const selY = interpolate(selSpring, [0, 1], [-20, 0]);

  const domDelay = a.dom?.delay ?? 18;
  const domSpring = spring({ frame: Math.max(0, frame - domDelay), fps, config: resolveSpring(a.dom?.spring) });
  const domOpacity = interpolate(domSpring, [0, 1], [0, 1]);
  const domY = interpolate(domSpring, [0, 1], [20, 0]);

  const headlineSpec = typographyStyle('headline');
  const captionSpec = typographyStyle('caption');
  const hasHeader = !!(eyebrow || title || badge || metric || subtitle);

  const renderDom = (node: DomNode, depth: number, idx: number): React.ReactNode => {
    const isMatched = node.matched || (node.id ? activeNodeIds.includes(node.id) : false);
    const indent = depth * 32;
    const labelColor = isMatched ? theme.color.accent : theme.color.textSecondary;
    return (
      <div key={`${depth}-${idx}-${node.label}`} style={{ marginLeft: indent }}>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 12,
            padding: '8px 16px',
            borderRadius: 10,
            background: isMatched ? `${theme.color.accent}1f` : 'transparent',
            border: isMatched ? `2px solid ${theme.color.accent}` : '2px solid transparent',
            margin: '4px 0',
            fontFamily: "'SF Mono', 'Fira Code', 'Consolas', monospace",
            fontSize: 22,
            color: labelColor,
            fontWeight: isMatched ? 700 : 500,
            boxShadow: isMatched ? theme.elevation.subtle : 'none',
          }}
        >
          {node.label}
          {isMatched && (
            <span
              style={{
                fontSize: 12,
                fontWeight: 800,
                background: theme.color.accent,
                color: '#fff',
                borderRadius: theme.radius.pill,
                padding: '2px 10px',
                fontFamily: theme.font.numeric,
                letterSpacing: '0.06em',
                textTransform: 'uppercase' as const,
              }}
            >
              MATCH
            </span>
          )}
        </div>
        {node.children && node.children.map((c, i) => renderDom(c, depth + 1, i))}
      </div>
    );
  };

  return (
    <AbsoluteFill
      style={{ background: theme.bg.primary, padding: '60px 100px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
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

      {/* Selector */}
      <div
        style={{
          padding: '24px 32px',
          background: theme.bg.code,
          border: `1px solid ${theme.color.divider}`,
          borderRadius: 16,
          marginBottom: 24,
          opacity: selOpacity,
          transform: `translateY(${selY}px)`,
          boxShadow: theme.elevation.subtle,
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 700, color: theme.color.textMuted, marginBottom: 8, letterSpacing: '0.08em', textTransform: 'uppercase' as const, fontFamily: theme.font.numeric }}>
          CSS Selector
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: "'SF Mono', 'Fira Code', 'Consolas', monospace", fontSize: 36, lineHeight: 1.3, flexWrap: 'wrap' }}>
          {tokens.map((t, i) => {
            const c = t.color || ROLE_COLORS[t.role];
            return (
              <span
                key={i}
                style={{
                  color: c,
                  fontWeight: t.role === 'plain' || t.role === 'combinator' ? 500 : 700,
                  background: t.role === 'plain' || t.role === 'combinator' ? 'transparent' : `${c}14`,
                  padding: t.role === 'plain' || t.role === 'combinator' ? 0 : '2px 10px',
                  borderRadius: 6,
                }}
              >
                {t.text}
              </span>
            );
          })}
        </div>
        <div style={{ fontSize: 16, color: theme.color.textMuted, marginTop: 12, fontFamily: "'SF Mono', 'Fira Code', 'Consolas', monospace" }}>
          → {selector}
        </div>
      </div>

      {/* DOM tree */}
      <div
        style={{
          flex: 1,
          background: theme.infographic.panelBg,
          border: `1px solid ${theme.infographic.panelBorder}`,
          borderRadius: 16,
          padding: '32px 36px',
          opacity: domOpacity,
          transform: `translateY(${domY}px)`,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          boxShadow: theme.elevation.subtle,
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 700, color: theme.color.accent, marginBottom: 16, letterSpacing: '0.08em', textTransform: 'uppercase' as const, fontFamily: theme.font.numeric, opacity: 0.7 }}>
          DOM Tree
        </div>
        {renderDom(dom, 0, 0)}
      </div>

      {explanation && (
        <p style={{ ...captionSpec, color: theme.color.textSecondary, marginTop: 18, textAlign: 'center', opacity: domOpacity }}>
          {explanation}
        </p>
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
