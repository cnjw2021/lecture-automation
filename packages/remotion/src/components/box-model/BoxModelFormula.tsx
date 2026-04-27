import { theme } from '../../theme';
import { toRgba } from './color';
import type { BoxModelFormulaTerm } from './types';

interface BoxModelFormulaProps {
  formula?: BoxModelFormulaTerm[];
  totalLabel?: string;
}

export const BoxModelFormula: React.FC<BoxModelFormulaProps> = ({ formula, totalLabel }) => {
  if (!formula?.length && !totalLabel) return null;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        marginTop: 14,
        flexWrap: 'wrap',
      }}
    >
      {formula?.map((term, index) => (
        <div key={`${term.label}-${index}`} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {index > 0 && (
            <span style={{ fontSize: 24, color: theme.color.textMuted, fontWeight: 800 }}>+</span>
          )}
          <span
            style={{
              fontFamily: theme.font.numeric,
              fontSize: 22,
              fontWeight: 900,
              color: term.color ?? theme.color.textPrimary,
              background: toRgba(term.color ?? theme.color.accent, 0.12),
              border: `1px solid ${toRgba(term.color ?? theme.color.accent, 0.24)}`,
              borderRadius: theme.radius.pill,
              padding: '7px 13px',
            }}
          >
            {term.label} {term.value}
          </span>
        </div>
      ))}
      {totalLabel && (
        <>
          <span style={{ fontSize: 24, color: theme.color.textMuted, fontWeight: 800 }}>=</span>
          <span
            style={{
              fontFamily: theme.font.numeric,
              fontSize: 26,
              fontWeight: 950,
              color: theme.color.textOnAccent,
              background: theme.color.accent,
              borderRadius: theme.radius.pill,
              padding: '8px 18px',
              boxShadow: theme.elevation.raised,
            }}
          >
            {totalLabel}
          </span>
        </>
      )}
    </div>
  );
};
