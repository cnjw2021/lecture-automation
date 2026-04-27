import { theme, typographyStyle } from '../../theme';
import { MetricBadge, SectionEyebrow } from '../shared';

interface BoxModelHeaderProps {
  titleOpacity: number;
  titleY: number;
  title?: string;
  subtitle?: string;
  eyebrow?: string;
  badge?: string;
  metric?: string;
}

export const BoxModelHeader: React.FC<BoxModelHeaderProps> = ({
  titleOpacity,
  titleY,
  title,
  subtitle,
  eyebrow,
  badge,
  metric,
}) => {
  const headlineSpec = typographyStyle('headline');
  const captionSpec = typographyStyle('caption');

  return (
    <div
      style={{
        opacity: titleOpacity,
        transform: `translateY(${titleY}px)`,
        marginBottom: 30,
      }}
    >
      {eyebrow && <SectionEyebrow text={eyebrow} />}
      <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
        {title && (
          <h1 style={{ ...headlineSpec, color: theme.color.textPrimary, margin: 0, flex: 1 }}>
            {title}
          </h1>
        )}
        {badge && (
          <span
            style={{
              fontSize: 17,
              fontWeight: 700,
              color: theme.infographic.badgeText,
              background: theme.infographic.badgeBg,
              border: `1px solid ${theme.infographic.panelBorder}`,
              borderRadius: theme.radius.pill,
              padding: '4px 14px',
              fontFamily: theme.font.numeric,
            }}
          >
            {badge}
          </span>
        )}
        {metric && <MetricBadge value={metric} color={theme.color.accent} size="sm" animate />}
      </div>
      {subtitle && (
        <p style={{ ...captionSpec, color: theme.color.textSecondary, margin: '10px 0 0' }}>
          {subtitle}
        </p>
      )}
    </div>
  );
};
