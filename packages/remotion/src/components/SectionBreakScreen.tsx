import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';
import { theme } from '../theme';
import { getAnimConfig, resolveSpring } from '../animation';
import type { ElementAnim } from '../animation';

interface SectionBreakScreenProps {
  section: string;
  title: string;
  subtitle?: string;
  color?: string;
  animation?: Record<string, Partial<ElementAnim>>;
}

interface SectionBreakScreenAnim {
  section: ElementAnim;
  title: ElementAnim;
  subtitle: ElementAnim;
}

export const SectionBreakScreen: React.FC<SectionBreakScreenProps> = ({
  section,
  title,
  subtitle,
  color,
  animation,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const a = getAnimConfig<SectionBreakScreenAnim>('SectionBreakScreen', animation);

  const accentColor = color || theme.color.accent;

  const secSpring = spring({ frame, fps, config: resolveSpring(a.section?.spring) });
  const secOpacity = interpolate(secSpring, [0, 1], [0, 1]);
  const secScale = interpolate(secSpring, [0, 1], [0.6, 1]);

  const titleDelay = a.title?.delay ?? 12;
  const titleSpring = spring({ frame: Math.max(0, frame - titleDelay), fps, config: resolveSpring(a.title?.spring) });
  const titleOpacity = interpolate(titleSpring, [0, 1], [0, 1]);
  const titleY = interpolate(titleSpring, [0, 1], [50, 0]);

  const subDelay = a.subtitle?.delay ?? 22;
  const subSpring = spring({ frame: Math.max(0, frame - subDelay), fps, config: resolveSpring(a.subtitle?.spring) });
  const subOpacity = interpolate(subSpring, [0, 1], [0, 1]);

  const lineWidth = interpolate(frame, [titleDelay, titleDelay + 25], [0, 300], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{ background: theme.bg.title, justifyContent: 'center', alignItems: 'center' }}>
      {/* Decorative large number/section behind */}
      <div
        style={{
          position: 'absolute',
          fontSize: 400,
          fontWeight: 900,
          color: accentColor,
          opacity: secOpacity * 0.05,
          transform: `scale(${secScale})`,
          lineHeight: 1,
        }}
      >
        {section}
      </div>

      {/* Glow */}
      <div
        style={{
          position: 'absolute',
          width: 700,
          height: 700,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${accentColor}10 0%, transparent 65%)`,
          transform: `scale(${secScale})`,
        }}
      />

      <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', padding: '0 120px' }}>
        {/* Section label */}
        <div
          style={{
            display: 'inline-block',
            padding: '10px 28px',
            borderRadius: 30,
            border: `2px solid ${accentColor}`,
            opacity: secOpacity,
            transform: `scale(${secScale})`,
            marginBottom: 32,
          }}
        >
          <span style={{ fontSize: 24, fontWeight: 700, color: accentColor, letterSpacing: '0.15em', textTransform: 'uppercase' }}>
            {section}
          </span>
        </div>

        {/* Title */}
        <h1
          style={{
            fontSize: 80,
            fontWeight: 800,
            color: theme.color.textPrimary,
            opacity: titleOpacity,
            transform: `translateY(${titleY}px)`,
            lineHeight: 1.2,
            marginBottom: 24,
          }}
        >
          {title}
        </h1>

        {/* Line */}
        <div style={{ width: lineWidth, height: 3, background: theme.color.gradientLine, margin: '0 auto 28px', borderRadius: 2 }} />

        {/* Subtitle */}
        {subtitle && (
          <p style={{ fontSize: 36, fontWeight: 400, color: theme.color.textSecondary, opacity: subOpacity }}>
            {subtitle}
          </p>
        )}
      </div>
    </AbsoluteFill>
  );
};
