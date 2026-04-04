import { AbsoluteFill } from 'remotion';
import { theme } from '../theme';

/**
 * Template-aware effects layer.
 * - warm-cream: no effects (pass-through)
 * - chalkboard: SVG noise texture overlay + chalk displacement filter on content
 */
export const TemplateEffects: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  if (!theme.effects.chalk) {
    return <>{children}</>;
  }

  const board = theme.effects.boardTexture as {
    noiseFrequency: number;
    noiseOctaves: number;
    noiseOpacity: number;
    scratchOpacity: number;
  };
  const chalk = theme.effects.chalkText as {
    displacementScale: number;
    noiseFrequency: number;
    textShadow: string;
  };

  return (
    <AbsoluteFill>
      {/* SVG filter definitions */}
      <svg
        style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }}
        aria-hidden="true"
      >
        <defs>
          {/* Chalk text displacement — roughens edges */}
          <filter id="chalkText" x="-3%" y="-3%" width="106%" height="106%">
            <feTurbulence
              type="fractalNoise"
              baseFrequency={chalk.noiseFrequency}
              numOctaves={5}
              seed={2}
              result="noise"
            />
            <feDisplacementMap
              in="SourceGraphic"
              in2="noise"
              scale={chalk.displacementScale}
              xChannelSelector="R"
              yChannelSelector="G"
            />
          </filter>

          {/* Board surface noise texture */}
          <filter id="boardNoise" x="0" y="0" width="100%" height="100%">
            <feTurbulence
              type="fractalNoise"
              baseFrequency={board.noiseFrequency}
              numOctaves={board.noiseOctaves}
              seed={7}
              stitchTiles="stitch"
              result="noise"
            />
            <feColorMatrix type="saturate" values="0" result="gray" />
            <feComponentTransfer result="faded">
              <feFuncA type="linear" slope={board.noiseOpacity} />
            </feComponentTransfer>
          </filter>

          {/* Scratch marks filter */}
          <filter id="boardScratches" x="0" y="0" width="100%" height="100%">
            <feTurbulence
              type="turbulence"
              baseFrequency="0.005 0.2"
              numOctaves={2}
              seed={42}
              stitchTiles="stitch"
              result="scratch"
            />
            <feColorMatrix type="saturate" values="0" result="gray" />
            <feComponentTransfer result="faded">
              <feFuncR type="linear" slope={3} intercept={-1} />
              <feFuncG type="linear" slope={3} intercept={-1} />
              <feFuncB type="linear" slope={3} intercept={-1} />
              <feFuncA type="linear" slope={board.scratchOpacity} />
            </feComponentTransfer>
          </filter>
        </defs>
      </svg>

      {/* Content with chalk displacement filter */}
      <AbsoluteFill style={{ filter: 'url(#chalkText)' }}>
        {children}
      </AbsoluteFill>

      {/* Board grain texture overlay */}
      <AbsoluteFill style={{ pointerEvents: 'none', mixBlendMode: 'soft-light' }}>
        <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
          <rect width="100%" height="100%" filter="url(#boardNoise)" />
        </svg>
      </AbsoluteFill>

      {/* Scratch marks overlay */}
      <AbsoluteFill style={{ pointerEvents: 'none', mixBlendMode: 'overlay', opacity: 0.5 }}>
        <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
          <rect width="100%" height="100%" fill="white" filter="url(#boardScratches)" />
        </svg>
      </AbsoluteFill>

      {/* Vignette — darker edges like a real chalkboard */}
      <AbsoluteFill
        style={{
          pointerEvents: 'none',
          background: 'radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.3) 100%)',
        }}
      />
    </AbsoluteFill>
  );
};
