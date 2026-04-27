import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { prism } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { useMemo } from 'react';
import { theme } from './theme';

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
    <AbsoluteFill style={{ backgroundColor: theme.bg.code, padding: '80px 120px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
      {title && (
        <h2
          style={{
            fontSize: 44,
            fontWeight: 800,
            color: theme.color.textPrimary,
            marginBottom: 32,
            opacity: titleOpacity,
            letterSpacing: '-0.01em',
          }}
        >
          {title}
        </h2>
      )}
      <div style={{ fontSize: '40px', overflow: 'hidden', border: `1px solid ${theme.color.divider}`, borderRadius: '20px', boxShadow: theme.elevation.subtle }}>
        <SyntaxHighlighter
          language={language}
          style={prism}
          customStyle={{ padding: '56px 64px', lineHeight: '1.65', margin: 0 }}
        >
          {codeToShow}
        </SyntaxHighlighter>
      </div>
    </AbsoluteFill>
  );
};
