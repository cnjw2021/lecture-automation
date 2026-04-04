import { Img, staticFile } from 'remotion';
import * as LucideIcons from 'lucide-react';
import { theme } from '../theme';

interface NodeIconProps {
  icon: string;
  size?: number;
}

// Lucide icon name mapping (kebab-case or PascalCase → component)
const getLucideIcon = (name: string): React.FC<any> | null => {
  // Convert kebab-case to PascalCase: "coffee" → "Coffee", "rocket-icon" → "RocketIcon"
  const pascalName = name
    .split('-')
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join('');

  return (LucideIcons as any)[pascalName] || null;
};

// Known brand icons that exist in public/icons/
const BRAND_ICONS = new Set([
  'claude', 'chatgpt', 'cursor', 'v0',
]);

const isEmoji = (str: string): boolean => {
  const emojiRegex = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2700}-\u{27BF}]/u;
  return emojiRegex.test(str);
};

export const NodeIcon: React.FC<NodeIconProps> = ({ icon, size = 44 }) => {
  // 1. Brand logo from public/icons/
  if (BRAND_ICONS.has(icon.toLowerCase())) {
    return (
      <Img
        src={staticFile(`icons/${icon.toLowerCase()}.svg`)}
        width={size}
        height={size}
        style={{ borderRadius: size * 0.22, objectFit: 'contain' }}
      />
    );
  }

  // 2. Lucide icon
  const LucideIcon = getLucideIcon(icon);
  if (LucideIcon) {
    return (
      <LucideIcon
        size={size * 0.75}
        color={theme.color.accent}
        strokeWidth={1.8}
      />
    );
  }

  // 3. Emoji fallback (but render larger and cleaner)
  if (isEmoji(icon)) {
    return (
      <span style={{
        fontSize: size * 0.8,
        lineHeight: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        {icon}
      </span>
    );
  }

  // 4. Text fallback
  return (
    <span style={{
      fontSize: size * 0.45,
      fontWeight: 700,
      color: theme.color.accent,
      lineHeight: 1,
    }}>
      {icon}
    </span>
  );
};
