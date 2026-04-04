import videoConfig from '../../../config/video.json';

const templateName = videoConfig.activeTemplate ?? 'warm-cream';
const template = (videoConfig.templates as Record<string, any>)[templateName];
const t = template.theme;

export const theme = {
  bg: {
    primary: t.backgrounds.primary as string,
    title: t.backgrounds.title as string,
    code: t.backgrounds.code as string,
  },
  color: {
    textPrimary: t.colors.textPrimary as string,
    textSecondary: t.colors.textSecondary as string,
    textMuted: t.colors.textMuted as string,
    accent: t.colors.accent as string,
    accentSecondary: t.colors.accentSecondary as string,
    accentMuted: t.colors.accentMuted as string,
    surface: t.colors.surface as string,
    surfaceBorder: t.colors.surfaceBorder as string,
    divider: t.colors.divider as string,
    gradientLine: t.colors.gradientLine as string,
    nodeBackground: t.colors.nodeBackground as string,
    nodeShadow: t.colors.nodeShadow as string,
    edgeShadow: t.colors.edgeShadow as string,
    edgeLabelBg: t.colors.edgeLabelBg as string,
    edgeLabelBorder: t.colors.edgeLabelBorder as string,
    textOnAccent: t.colors.textOnAccent as string,
    stepPast: t.colors.stepPast as string,
    stepInactive: t.colors.stepInactive as string,
    stepInactiveBorder: t.colors.stepInactiveBorder as string,
  },
  glow: {
    title: t.glow.title as string,
  },
} as const;
