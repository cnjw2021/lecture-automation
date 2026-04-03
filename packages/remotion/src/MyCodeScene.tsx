import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { prism } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { useMemo } from 'react';

interface MyCodeSceneProps {
  code?: string;
  language?: string;
  title?: string;
}

const DEFAULT_CODE = `<!DOCTYPE html>
<html>
  <body>
    <h1>Hello World</h1>
    <p>Welcome to the web.</p>
  </body>
</html>`;

export const MyCodeScene: React.FC<MyCodeSceneProps> = ({
  code = DEFAULT_CODE,
  language = 'html',
  title,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const codeToShow = useMemo(() => {
    const charsToShow = Math.floor(
      interpolate(frame, [0, fps * 2], [0, code.length], {
        extrapolateRight: 'clamp',
      })
    );
    return code.slice(0, charsToShow);
  }, [frame, fps, code]);

  // Title fade in
  const titleOpacity = title
    ? interpolate(frame, [0, 15], [0, 1], { extrapolateRight: 'clamp' })
    : 0;

  return (
    <AbsoluteFill style={{ backgroundColor: '#ffffff', padding: '60px' }}>
      {title && (
        <h2
          style={{
            fontSize: 32,
            fontWeight: 700,
            color: '#1a1a2e',
            marginBottom: 20,
            opacity: titleOpacity,
          }}
        >
          {title}
        </h2>
      )}
      <div style={{ fontSize: '35px', overflow: 'hidden', border: '1px solid #ddd', borderRadius: '15px' }}>
        <SyntaxHighlighter
          language={language}
          style={prism}
          customStyle={{ padding: '40px', lineHeight: '1.5' }}
        >
          {codeToShow}
        </SyntaxHighlighter>
      </div>
    </AbsoluteFill>
  );
};
