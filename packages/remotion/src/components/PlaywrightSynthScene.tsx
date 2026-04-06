import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
  Img,
  staticFile,
} from 'remotion';

/**
 * step별 스크린샷 + 이벤트 매니페스트를 기반으로
 * Playwright 씬을 합성 렌더링하는 컴포넌트.
 *
 * 피드백 문서의 "상태 합성형" 접근법 구현:
 * - 스크린샷 간 부드러운 전환
 * - 커서 이동 애니메이션 (spring)
 * - 클릭 이펙트 (ripple)
 * - 타이핑 오버레이
 * - 하이라이트 박스
 */

interface CursorPosition {
  x: number;
  y: number;
}

interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface StepData {
  index: number;
  cmd: string;
  screenshot: string;
  cursorFrom?: CursorPosition;
  cursorTo?: CursorPosition;
  targetBox?: BoundingBox;
  typedText?: string;
  scrollY?: number;
  durationMs: number;
  isClick?: boolean;
  isHighlight?: boolean;
  note?: string;
}

interface SceneManifest {
  sceneId: number;
  lectureId: string;
  totalSteps: number;
  totalDurationMs: number;
  viewport: { width: number; height: number };
  steps: StepData[];
}

interface PlaywrightSynthSceneProps {
  manifest: SceneManifest;
  lectureId: string;
}

export const PlaywrightSynthScene: React.FC<PlaywrightSynthSceneProps> = ({
  manifest,
  lectureId,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const totalFrames = Math.ceil((manifest.totalDurationMs / 1000) * fps);

  // step별 프레임 범위 계산
  const stepFrameRanges: Array<{ start: number; end: number; step: StepData }> = [];
  let accFrames = 0;
  for (const step of manifest.steps) {
    const stepFrameCount = Math.ceil((step.durationMs / 1000) * fps);
    stepFrameRanges.push({
      start: accFrames,
      end: accFrames + stepFrameCount,
      step,
    });
    accFrames += stepFrameCount;
  }

  // 현재 프레임에 해당하는 step 찾기
  const currentRange = stepFrameRanges.find(
    (r) => frame >= r.start && frame < r.end
  ) || stepFrameRanges[stepFrameRanges.length - 1];

  if (!currentRange) return <AbsoluteFill style={{ backgroundColor: '#000' }} />;

  const { step, start: stepStart, end: stepEnd } = currentRange;
  const stepProgress = (frame - stepStart) / Math.max(1, stepEnd - stepStart - 1);
  const localFrame = frame - stepStart;

  // 다음 step의 스크린샷 (크로스페이드용)
  const nextRange = stepFrameRanges.find((r) => r.start === stepEnd);
  const basePath = `state-captures/${lectureId}/scene-${manifest.sceneId}`;

  // 커서 위치 보간
  const cursorX = step.cursorFrom && step.cursorTo
    ? interpolate(stepProgress, [0, 1], [step.cursorFrom.x, step.cursorTo.x])
    : step.cursorTo?.x ?? -100;
  const cursorY = step.cursorFrom && step.cursorTo
    ? interpolate(stepProgress, [0, 1], [step.cursorFrom.y, step.cursorTo.y])
    : step.cursorTo?.y ?? -100;

  // 클릭 이펙트 (ripple)
  const clickRippleScale = step.isClick
    ? spring({ frame: localFrame, fps, config: { damping: 12, stiffness: 100, mass: 0.5 } })
    : 0;
  const clickRippleOpacity = step.isClick
    ? interpolate(clickRippleScale, [0, 0.5, 1], [0.6, 0.3, 0])
    : 0;

  // 타이핑 오버레이 — 입력 텍스트 progressive reveal
  const typedChars = step.typedText
    ? Math.floor(stepProgress * step.typedText.length)
    : 0;
  const visibleText = step.typedText?.substring(0, typedChars) ?? '';

  // 하이라이트 박스 페이드인
  const highlightOpacity = step.isHighlight
    ? spring({ frame: localFrame, fps, config: { damping: 14, stiffness: 80, mass: 0.6 } })
    : 0;

  // 스크린샷 크로스페이드 (step 마지막 20% 구간)
  const crossfadeStart = 0.8;
  const crossfadeOpacity =
    nextRange && stepProgress > crossfadeStart
      ? interpolate(stepProgress, [crossfadeStart, 1], [0, 1], { extrapolateRight: 'clamp' })
      : 0;

  return (
    <AbsoluteFill>
      {/* 현재 step 스크린샷 */}
      <Img
        src={staticFile(`${basePath}/${step.screenshot}`)}
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
      />

      {/* 다음 step 스크린샷 크로스페이드 */}
      {nextRange && crossfadeOpacity > 0 && (
        <AbsoluteFill style={{ opacity: crossfadeOpacity }}>
          <Img
            src={staticFile(`${basePath}/${nextRange.step.screenshot}`)}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        </AbsoluteFill>
      )}

      {/* 하이라이트 박스 */}
      {step.isHighlight && step.targetBox && (
        <div
          style={{
            position: 'absolute',
            left: step.targetBox.x - 4,
            top: step.targetBox.y - 4,
            width: step.targetBox.width + 8,
            height: step.targetBox.height + 8,
            border: '4px solid #ff007a',
            borderRadius: 4,
            opacity: highlightOpacity,
            pointerEvents: 'none',
          }}
        />
      )}

      {/* 타이핑 오버레이 */}
      {step.typedText && step.targetBox && (
        <div
          style={{
            position: 'absolute',
            left: step.targetBox.x + 4,
            top: step.targetBox.y + 2,
            fontSize: 14,
            fontFamily: 'monospace',
            color: '#333',
            pointerEvents: 'none',
            whiteSpace: 'pre',
          }}
        >
          {visibleText}
          {/* 커서 깜빡임 */}
          <span
            style={{
              opacity: Math.sin(frame * 0.3) > 0 ? 1 : 0,
              borderRight: '2px solid #333',
              marginLeft: 1,
            }}
          />
        </div>
      )}

      {/* 클릭 리플 이펙트 */}
      {step.isClick && clickRippleOpacity > 0 && (
        <div
          style={{
            position: 'absolute',
            left: cursorX - 20,
            top: cursorY - 20,
            width: 40,
            height: 40,
            borderRadius: '50%',
            border: '2px solid rgba(0, 120, 255, 0.6)',
            transform: `scale(${1 + clickRippleScale * 2})`,
            opacity: clickRippleOpacity,
            pointerEvents: 'none',
          }}
        />
      )}

      {/* 커서 */}
      {cursorX > 0 && cursorY > 0 && (
        <div
          style={{
            position: 'absolute',
            left: cursorX - 7,
            top: cursorY - 7,
            width: 14,
            height: 14,
            borderRadius: '50%',
            background: 'rgba(0, 0, 0, 0.85)',
            border: '2px solid rgba(255, 255, 255, 0.9)',
            boxShadow: '0 0 0 1px rgba(0, 0, 0, 0.4)',
            pointerEvents: 'none',
            zIndex: 9999,
          }}
        />
      )}
    </AbsoluteFill>
  );
};
