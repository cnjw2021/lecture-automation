import * as LucideIcons from 'lucide-react';
import iconsConfig from '../../../../config/icons.json';

// --- Types ---

export type ResolvedIcon =
  | { type: 'brand'; name: string }
  | { type: 'lucide'; Component: React.FC<any> }
  | { type: 'emoji'; value: string }
  | { type: 'text'; value: string };

// --- Data from config (SSoT) ---

const brandIcons = new Set(iconsConfig.brandIcons);
const emojiToLucide: Record<string, string> = iconsConfig.emojiToLucide;
const emojiToBrandIcon: Record<string, string> = (iconsConfig as any).emojiToBrandIcon ?? {};

// --- Pure helpers ---

const isKeycapEmoji = (str: string): boolean => /^(?:[#*0-9]\uFE0F?\u20E3)$/u.test(str);
const isFlagEmoji = (str: string): boolean => /^(?:\p{Regional_Indicator}{2})$/u.test(str);
const isPictographicEmoji = (str: string): boolean => /\p{Extended_Pictographic}/u.test(str);

const isEmoji = (str: string): boolean => {
  return isKeycapEmoji(str) || isFlagEmoji(str) || isPictographicEmoji(str);
};

const toLucideComponent = (name: string): React.FC<any> | null => {
  const icons = LucideIcons as Record<string, any>;

  // Exact match
  if (icons[name]) return icons[name];

  // kebab-case → PascalCase: "shopping-cart" → "ShoppingCart"
  const pascal = name
    .split('-')
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join('');

  return icons[pascal] || null;
};

// --- Main resolver (pure function, no React rendering) ---

export const resolveIcon = (icon: string): ResolvedIcon => {
  // 1. Brand logo
  if (brandIcons.has(icon.toLowerCase())) {
    return { type: 'brand', name: icon.toLowerCase() };
  }

  // 2. Emoji → brand icon override (system font에서 렌더링 불가한 이모지용)
  const brandOverride = emojiToBrandIcon[icon];
  if (brandOverride && brandIcons.has(brandOverride)) {
    return { type: 'brand', name: brandOverride };
  }

  // 3. Emoji → Lucide auto-conversion
  if (isEmoji(icon)) {
    const lucideName = emojiToLucide[icon];
    if (lucideName) {
      const Component = toLucideComponent(lucideName);
      if (Component) return { type: 'lucide', Component };
    }
    return { type: 'emoji', value: icon };
  }

  // 3. Lucide by name
  const Component = toLucideComponent(icon);
  if (Component) return { type: 'lucide', Component };

  // 4. Text fallback
  return { type: 'text', value: icon };
};
