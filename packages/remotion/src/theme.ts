import videoConfig from '../../../config/video.json';

const t = videoConfig.theme;

export const theme = {
  bg: {
    primary: t.backgrounds.primary,
    title: t.backgrounds.title,
    code: t.backgrounds.code,
  },
  color: {
    textPrimary: t.colors.textPrimary,
    textSecondary: t.colors.textSecondary,
    textMuted: t.colors.textMuted,
    accent: t.colors.accent,
    accentSecondary: t.colors.accentSecondary,
    accentMuted: t.colors.accentMuted,
    surface: t.colors.surface,
    surfaceBorder: t.colors.surfaceBorder,
    divider: t.colors.divider,
    gradientLine: t.colors.gradientLine,
  },
  glow: {
    title: t.glow.title,
  },
} as const;
