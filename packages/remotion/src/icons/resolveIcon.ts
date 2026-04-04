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

// --- Pure helpers ---

const isEmoji = (str: string): boolean => {
  return /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{200D}\u{20E3}]/u.test(str);
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

  // 2. Emoji → Lucide auto-conversion
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
