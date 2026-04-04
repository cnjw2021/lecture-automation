import { Img, staticFile } from 'remotion';
import * as LucideIcons from 'lucide-react';
import { theme } from '../theme';

interface NodeIconProps {
  icon: string;
  size?: number;
}

// Emoji → Lucide icon auto-mapping
// 이모지가 들어와도 자동으로 고품질 Lucide 아이콘으로 변환
const EMOJI_TO_LUCIDE: Record<string, string> = {
  // People & Roles
  '👤': 'User', '👥': 'Users', '🧑': 'User', '👨': 'User', '👩': 'User',
  '🧑‍💻': 'UserCog', '👨‍💻': 'UserCog', '👩‍💻': 'UserCog',
  '🧑‍🏫': 'GraduationCap', '👨‍🏫': 'GraduationCap', '👩‍🏫': 'GraduationCap',
  '🧑‍🎓': 'GraduationCap', '🎓': 'GraduationCap',
  '🤖': 'Bot', '👾': 'Bot',

  // Communication
  '💬': 'MessageSquare', '🗨️': 'MessageCircle', '💭': 'MessageCircle',
  '📧': 'Mail', '✉️': 'Mail', '📨': 'Mail',
  '📞': 'Phone', '☎️': 'Phone',

  // Tech & Code
  '💻': 'Laptop', '🖥️': 'Monitor', '⌨️': 'Keyboard',
  '📱': 'Smartphone', '📲': 'Smartphone',
  '🌐': 'Globe', '🔗': 'Link', '🔌': 'Plug',
  '⚙️': 'Settings', '🔧': 'Wrench', '🛠️': 'Wrench',
  '🔨': 'Hammer', '✏️': 'Pencil', '🖊️': 'PenLine',
  '📝': 'FileEdit', '🎨': 'Palette', '🖌️': 'Paintbrush',
  '🗄️': 'Database', '📊': 'BarChart3', '📈': 'TrendingUp', '📉': 'TrendingDown',
  '🧩': 'Puzzle', '🔐': 'Lock', '🔑': 'Key', '🔒': 'Lock', '🔓': 'Unlock',
  '🐛': 'Bug', '🧪': 'TestTube', '🔬': 'Microscope',

  // Files & Documents
  '📄': 'FileText', '📃': 'FileText', '📋': 'ClipboardList',
  '📁': 'Folder', '📂': 'FolderOpen', '🗂️': 'FolderTree',
  '📖': 'BookOpen', '📚': 'Library', '📕': 'Book', '📗': 'Book', '📘': 'Book',

  // Actions & Symbols
  '✅': 'CheckCircle', '❌': 'XCircle', '⭕': 'Circle',
  '✨': 'Sparkles', '⭐': 'Star', '🌟': 'Star',
  '💡': 'Lightbulb', '🔍': 'Search', '🔎': 'SearchCheck',
  '🚀': 'Rocket', '🎯': 'Target', '🏆': 'Trophy', '🏅': 'Medal',
  '⚡': 'Zap', '🔥': 'Flame', '💥': 'Sparkles',
  '♻️': 'RefreshCcw', '🔄': 'RefreshCw',
  '➡️': 'ArrowRight', '⬆️': 'ArrowUp', '⬇️': 'ArrowDown', '⬅️': 'ArrowLeft',
  '▶️': 'Play', '⏸️': 'Pause', '⏹️': 'Square',

  // Objects
  '☕': 'Coffee', '🍵': 'Coffee',
  '🎬': 'Clapperboard', '🎥': 'Video', '📹': 'Video', '🎞️': 'Film',
  '📸': 'Camera', '📷': 'Camera',
  '🎵': 'Music', '🎶': 'Music2', '🔊': 'Volume2', '🔔': 'Bell',
  '🛒': 'ShoppingCart', '🛍️': 'ShoppingBag', '💰': 'Coins', '💳': 'CreditCard',
  '🏠': 'Home', '🏢': 'Building', '🏗️': 'Building2',
  '🗺️': 'Map', '📍': 'MapPin', '📌': 'Pin',
  '⏰': 'Clock', '🕐': 'Clock', '⏱️': 'Timer',
  '📅': 'Calendar', '🗓️': 'CalendarDays',
  '🎁': 'Gift', '🧰': 'Briefcase', '💼': 'Briefcase',
  '🔋': 'Battery', '☁️': 'Cloud', '🌩️': 'CloudLightning',
  '📡': 'Wifi', '📤': 'Upload', '📥': 'Download',
  '🗑️': 'Trash2', '📌': 'Pin', '🏷️': 'Tag',

  // Arrows & Navigation
  '🔙': 'ArrowLeft', '🔜': 'ArrowRight',
  '🆕': 'Plus', '🆗': 'Check',

  // Nature & Weather (occasionally used in presentations)
  '🌍': 'Globe', '🌎': 'Globe', '🌏': 'Globe',
  '☀️': 'Sun', '🌙': 'Moon', '🌤️': 'CloudSun',
  '🌈': 'Rainbow', '💧': 'Droplet', '🌊': 'Waves',
  '🌱': 'Sprout', '🌿': 'Leaf', '🍀': 'Clover',
  '🐢': 'Turtle',

  // Gestures
  '👍': 'ThumbsUp', '👎': 'ThumbsDown', '👋': 'Hand',
  '🤝': 'Handshake', '✋': 'Hand', '☝️': 'Pointer',
  '💪': 'Dumbbell',

  // Expressions & Faces
  '😀': 'Smile', '😊': 'Smile', '😃': 'Smile',
  '😢': 'Frown', '😡': 'Angry',
  '🤔': 'HelpCircle', '❓': 'HelpCircle', '❗': 'AlertCircle',
  '⚠️': 'AlertTriangle', '🚫': 'Ban', '⛔': 'Ban',
  'ℹ️': 'Info', '💯': 'BadgeCheck',
};

// Known brand icons that exist in public/icons/
const BRAND_ICONS = new Set([
  'claude', 'chatgpt', 'cursor', 'v0',
]);

// Lucide icon name → component lookup
const getLucideIcon = (name: string): React.FC<any> | null => {
  // Try exact PascalCase first
  if ((LucideIcons as any)[name]) {
    return (LucideIcons as any)[name];
  }

  // Convert kebab-case to PascalCase: "coffee" → "Coffee", "shopping-cart" → "ShoppingCart"
  const pascalName = name
    .split('-')
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join('');

  return (LucideIcons as any)[pascalName] || null;
};

const isEmoji = (str: string): boolean => {
  const emojiRegex = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{200D}\u{20E3}]/u;
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

  // 2. Emoji → auto-convert to Lucide icon
  if (isEmoji(icon)) {
    const lucideName = EMOJI_TO_LUCIDE[icon];
    if (lucideName) {
      const LucideIcon = getLucideIcon(lucideName);
      if (LucideIcon) {
        return (
          <LucideIcon
            size={size * 0.75}
            color={theme.color.accent}
            strokeWidth={1.8}
          />
        );
      }
    }
    // Unmapped emoji — render as text but larger
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

  // 3. Lucide icon by name (e.g., "coffee", "rocket", "shopping-cart")
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
