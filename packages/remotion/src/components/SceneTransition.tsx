import { AbsoluteFill, useCurrentFrame, interpolate } from 'remotion';
import { getAnimConfig, type SceneTransitionAnim } from '../animation';

interface SceneTransitionProps {
  durationInFrames: number;
  enter?: 'fade' | 'slide-left' | 'slide-up' | 'zoom' | 'none';
  exit?: 'fade' | 'slide-right' | 'slide-down' | 'zoom' | 'none';
  enterDuration?: number;
  exitDuration?: number;
  children: React.ReactNode;
}

export const SceneTransition: React.FC<SceneTransitionProps> = ({
  durationInFrames,
  enter = 'fade',
  exit = 'fade',
  enterDuration: enterDurationProp,
  exitDuration: exitDurationProp,
  children,
}) => {
  const frame = useCurrentFrame();
  const a = getAnimConfig<SceneTransitionAnim>('SceneTransition');

  const enterDuration = enterDurationProp ?? a.enterDuration ?? 15;
  const exitDuration = exitDurationProp ?? a.exitDuration ?? 10;
  const d = a.distances ?? { slideX: 60, slideY: 40, zoomScale: [0.9, 1], zoomExitScale: [1, 1.1] };

  const exitStart = durationInFrames - exitDuration;

  // Enter animation
  const enterProgress = interpolate(frame, [0, enterDuration], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Exit animation
  const exitProgress = interpolate(frame, [exitStart, durationInFrames], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const getEnterStyle = (): React.CSSProperties => {
    switch (enter) {
      case 'fade':
        return { opacity: enterProgress };
      case 'slide-left':
        return {
          opacity: enterProgress,
          transform: `translateX(${interpolate(enterProgress, [0, 1], [-d.slideX, 0])}px)`,
        };
      case 'slide-up':
        return {
          opacity: enterProgress,
          transform: `translateY(${interpolate(enterProgress, [0, 1], [d.slideY, 0])}px)`,
        };
      case 'zoom':
        return {
          opacity: enterProgress,
          transform: `scale(${interpolate(enterProgress, [0, 1], d.zoomScale)})`,
        };
      case 'none':
      default:
        return {};
    }
  };

  const getExitStyle = (): React.CSSProperties => {
    switch (exit) {
      case 'fade':
        return { opacity: exitProgress };
      case 'slide-right':
        return {
          opacity: exitProgress,
          transform: `translateX(${interpolate(exitProgress, [1, 0], [0, d.slideX])}px)`,
        };
      case 'slide-down':
        return {
          opacity: exitProgress,
          transform: `translateY(${interpolate(exitProgress, [1, 0], [0, d.slideY])}px)`,
        };
      case 'zoom':
        return {
          opacity: exitProgress,
          transform: `scale(${interpolate(exitProgress, [1, 0], d.zoomExitScale)})`,
        };
      case 'none':
      default:
        return {};
    }
  };

  // Combine enter and exit
  const enterStyle = getEnterStyle();
  const exitStyle = getExitStyle();

  const enterOpacity = (enterStyle.opacity ?? 1) as number;
  const exitOpacity = (exitStyle.opacity ?? 1) as number;
  const combinedOpacity = enterOpacity * exitOpacity;
  const combinedTransform = [enterStyle.transform, exitStyle.transform].filter(Boolean).join(' ') || undefined;

  return (
    <AbsoluteFill
      style={{
        opacity: combinedOpacity,
        transform: combinedTransform,
      }}
    >
      {children}
    </AbsoluteFill>
  );
};
