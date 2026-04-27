import type { BoxModelCallout, BoxModelLayer, BoxModelLayerKey, ResolvedBoxModelLayer } from './types';

export const LAYER_ORDER: BoxModelLayerKey[] = ['margin', 'border', 'padding', 'content'];

export const DEFAULT_LAYERS: ResolvedBoxModelLayer[] = [
  {
    key: 'margin',
    label: 'マージン',
    value: '30px',
    description: '箱の外側。背景色はつかない透明な余白',
    color: '#ef4444',
  },
  {
    key: 'border',
    label: 'ボーダー',
    value: '2px',
    description: '箱の境界線',
    color: '#f59e0b',
  },
  {
    key: 'padding',
    label: 'パディング',
    value: '20px',
    description: '箱の内側。背景色がつく余白',
    color: '#10b981',
  },
  {
    key: 'content',
    label: 'コンテント',
    value: '300px',
    description: 'テキストや画像など実際の中身',
    color: '#3b82f6',
  },
];

export const layerMapFrom = (layers?: BoxModelLayer[]): Record<BoxModelLayerKey, ResolvedBoxModelLayer> => {
  const base = Object.fromEntries(DEFAULT_LAYERS.map(layer => [layer.key, layer])) as Record<
    BoxModelLayerKey,
    ResolvedBoxModelLayer
  >;

  for (const layer of layers ?? []) {
    base[layer.key] = { ...base[layer.key], ...layer };
  }

  return base;
};

export const calloutsFromLayers = (
  layerByKey: Record<BoxModelLayerKey, ResolvedBoxModelLayer>,
): BoxModelCallout[] =>
  LAYER_ORDER.map(key => ({
    title: `${layerByKey[key].label}${layerByKey[key].value ? `: ${layerByKey[key].value}` : ''}`,
    detail: layerByKey[key].description,
    color: layerByKey[key].color,
  }));
