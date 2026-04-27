import { interpolate, spring } from 'remotion';
import { theme } from '../../theme';
import { InfographicPanel } from '../shared';
import { toRgba } from './color';
import type { BoxModelCallout } from './types';

interface BoxModelCalloutsProps {
  frame: number;
  fps: number;
  callouts: BoxModelCallout[];
}

export const BoxModelCallouts: React.FC<BoxModelCalloutsProps> = ({ frame, fps, callouts }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
    {callouts.map((callout, index) => {
      const color = callout.color ?? theme.color.accent;
      const itemSpring = spring({
        frame: Math.max(0, frame - 18 - index * 7),
        fps,
        config: { damping: 18, stiffness: 130, mass: 0.7 },
      });
      const opacity = interpolate(itemSpring, [0, 1], [0, 1]);
      const x = interpolate(itemSpring, [0, 1], [24, 0]);

      return (
        <InfographicPanel
          key={`${callout.title}-${index}`}
          variant={index === 0 ? 'strong' : 'default'}
          borderAccent={color}
          borderPosition="left"
          style={{
            padding: '19px 22px',
            opacity,
            transform: `translateX(${x}px)`,
          }}
        >
          <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: theme.radius.card,
                background: toRgba(color, 0.15),
                border: `1px solid ${toRgba(color, 0.26)}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                marginTop: 3,
              }}
            >
              <span style={{ width: 13, height: 13, borderRadius: 4, background: color }} />
            </div>
            <div>
              <h3
                style={{
                  margin: 0,
                  color,
                  fontSize: 27,
                  fontWeight: 850,
                  lineHeight: 1.25,
                }}
              >
                {callout.title}
              </h3>
              <p
                style={{
                  margin: '6px 0 0',
                  color: theme.color.textSecondary,
                  fontSize: 21,
                  lineHeight: 1.45,
                }}
              >
                {callout.detail}
              </p>
            </div>
          </div>
        </InfographicPanel>
      );
    })}
  </div>
);
