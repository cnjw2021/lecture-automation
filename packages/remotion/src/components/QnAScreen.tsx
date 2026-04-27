import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';
import { theme } from '../theme';
import { getAnimConfig, resolveSpring } from '../animation';
import type { ElementAnim } from '../animation';

interface QnAScreenProps {
  question: string;
  answer: string;
  icon?: string;
  animation?: Record<string, Partial<ElementAnim>>;
}

interface QnAScreenAnim {
  question: ElementAnim;
  answer: ElementAnim;
}

export const QnAScreen: React.FC<QnAScreenProps> = ({ question, answer, animation }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const a = getAnimConfig<QnAScreenAnim>('QnAScreen', animation);

  const qSpring = spring({ frame, fps, config: resolveSpring(a.question?.spring) });
  const qOpacity = interpolate(qSpring, [0, 1], [0, 1]);
  const qY = interpolate(qSpring, [0, 1], [40, 0]);

  const aDelay = a.answer?.delay ?? 25;
  const aSpring = spring({ frame: Math.max(0, frame - aDelay), fps, config: resolveSpring(a.answer?.spring) });
  const aOpacity = interpolate(aSpring, [0, 1], [0, 1]);
  const aY = interpolate(aSpring, [0, 1], [30, 0]);

  const lineWidth = interpolate(frame, [aDelay - 5, aDelay + 10], [0, 120], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{ background: theme.bg.primary, justifyContent: 'center', padding: '0 160px' }}>
      {/* Question */}
      <div style={{ opacity: qOpacity, transform: `translateY(${qY}px)`, marginBottom: 56 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 32 }}>
          <span style={{ fontSize: 110, fontWeight: 900, color: theme.color.accent, opacity: 0.45, lineHeight: 1, flexShrink: 0, fontFamily: theme.font.numeric }}>Q</span>
          <p style={{ fontSize: 56, fontWeight: 700, color: theme.color.textPrimary, lineHeight: 1.4, margin: 0 }}>
            {question}
          </p>
        </div>
      </div>

      {/* Divider */}
      <div style={{ width: lineWidth, height: 3, background: theme.color.gradientLine, margin: '0 0 56px 142px', borderRadius: 2 }} />

      {/* Answer */}
      <div style={{ opacity: aOpacity, transform: `translateY(${aY}px)` }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 32 }}>
          <span style={{ fontSize: 110, fontWeight: 900, color: theme.color.accentSecondary, opacity: 0.45, lineHeight: 1, flexShrink: 0, fontFamily: theme.font.numeric }}>A</span>
          <p style={{ fontSize: 40, fontWeight: 500, color: theme.color.textSecondary, lineHeight: 1.65, margin: 0 }}>
            {answer}
          </p>
        </div>
      </div>
    </AbsoluteFill>
  );
};
