import videoConfig from '../../../config/video.json';

const templateName = videoConfig.activeTemplate ?? 'warm-cream';
const template = (videoConfig.templates as Record<string, any>)[templateName];
const t = template.theme;

export type TypographyToken = 'eyebrow' | 'caption' | 'body' | 'title' | 'headline' | 'display' | 'metric';

export interface TypographySpec {
  size: number;
  weight: number;
  lineHeight: number;
  letterSpacing: string;
  fontFamily: string;
}

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
  typography: {
    eyebrow: t.typography.eyebrow as TypographySpec,
    caption: t.typography.caption as TypographySpec,
    body: t.typography.body as TypographySpec,
    title: t.typography.title as TypographySpec,
    headline: t.typography.headline as TypographySpec,
    display: t.typography.display as TypographySpec,
    metric: t.typography.metric as TypographySpec,
  },
  elevation: {
    subtle: t.elevation.subtle as string,
    raised: t.elevation.raised as string,
    floating: t.elevation.floating as string,
  },
  radius: {
    panel: t.radius.panel as number,
    card: t.radius.card as number,
    pill: t.radius.pill as number,
  },
  infographic: {
    panelBg: t.infographic.panelBg as string,
    panelBgStrong: t.infographic.panelBgStrong as string,
    panelBorder: t.infographic.panelBorder as string,
    panelBorderStrong: t.infographic.panelBorderStrong as string,
    badgeBg: t.infographic.badgeBg as string,
    badgeText: t.infographic.badgeText as string,
    metricBg: t.infographic.metricBg as string,
    metricText: t.infographic.metricText as string,
    connector: t.infographic.connector as string,
    spotlight: t.infographic.spotlight as string,
    success: t.infographic.success as string,
    warning: t.infographic.warning as string,
    danger: t.infographic.danger as string,
  },
} as const;

export interface CSSTypographyStyle {
  fontSize: number;
  fontWeight: number;
  lineHeight: number;
  letterSpacing: string;
  fontFamily: string;
}

/** typography 토큰을 React style 객체로 변환 */
export function typographyStyle(token: TypographyToken): CSSTypographyStyle {
  const spec = theme.typography[token];
  return {
    fontSize: spec.size,
    fontWeight: spec.weight,
    lineHeight: spec.lineHeight,
    letterSpacing: spec.letterSpacing,
    fontFamily: spec.fontFamily,
  };
}
