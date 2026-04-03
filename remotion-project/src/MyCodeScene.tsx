import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
// 밝은 배경용 테마를 불러옵니다
import { prism } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { useMemo } from 'react';

export const MyCodeScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const fullCode = `<!DOCTYPE html>
<html>
  <body>
    <h1>흰색 배경 테스트</h1>
    <p>글자 테두리가 여전히 날카로운가요?</p>
  </body>
</html>`;

  const codeToShow = useMemo(() => {
    const charsToShow = Math.floor(
      interpolate(frame, [0, fps * 2], [0, fullCode.length], {
        extrapolateRight: 'clamp',
      })
    );
    return fullCode.slice(0, charsToShow);
  }, [frame, fps, fullCode]);

  return (
    // 배경색을 흰색(#ffffff)으로 변경
    <AbsoluteFill style={{ backgroundColor: '#ffffff', padding: '60px' }}>
      <div style={{ fontSize: '35px', overflow: 'hidden', border: '1px solid #ddd', borderRadius: '15px' }}>
        <SyntaxHighlighter 
          language="html" 
          style={prism} // 밝은 테마 적용
          customStyle={{ padding: '40px', lineHeight: '1.5' }}
        >
          {codeToShow}
        </SyntaxHighlighter>
      </div>
    </AbsoluteFill>
  );
};
