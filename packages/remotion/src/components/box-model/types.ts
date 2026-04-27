import type { BackdropVariant } from '../shared';

export type BoxModelLayerKey = 'margin' | 'border' | 'padding' | 'content';

export interface BoxModelLayer {
  key: BoxModelLayerKey;
  label?: string;
  value?: string;
  description?: string;
  color?: string;
}

export interface ResolvedBoxModelLayer {
  key: BoxModelLayerKey;
  label: string;
  value: string;
  description: string;
  color: string;
}

export interface BoxModelFormulaTerm {
  label: string;
  value: string;
  color?: string;
}

export interface BoxModelCallout {
  title: string;
  detail: string;
  color?: string;
}

export interface BoxModelDiagramScreenProps {
  title?: string;
  subtitle?: string;
  eyebrow?: string;
  badge?: string;
  metric?: string;
  caption?: string;
  footnote?: string;
  backdropVariant?: BackdropVariant;
  contentLabel?: string;
  contentDetail?: string;
  highlightLayer?: BoxModelLayerKey;
  layers?: BoxModelLayer[];
  callouts?: BoxModelCallout[];
  formula?: BoxModelFormulaTerm[];
  totalLabel?: string;
}
