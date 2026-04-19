#!/usr/bin/env node

import { createRequire } from 'module';
import { readdirSync, readFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const lucideIcons = require('lucide-react');
const iconsConfig = require('../config/icons.json');

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DATA_DIR = join(ROOT, 'data');
const ICONS_DIR = join(ROOT, 'packages', 'remotion', 'public', 'icons');
const allowedEmojiFallbacks = new Set(iconsConfig.allowedEmojiFallbacks ?? []);

const isKeycapEmoji = (value) => /^(?:[#*0-9]\uFE0F?\u20E3)$/u.test(value);
const isFlagEmoji = (value) => /^(?:\p{Regional_Indicator}{2})$/u.test(value);
const isPictographicEmoji = (value) => /\p{Extended_Pictographic}/u.test(value);
const isEmoji = (value) => isKeycapEmoji(value) || isFlagEmoji(value) || isPictographicEmoji(value);

const toLucideComponentName = (name) =>
  name
    .split('-')
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join('');

const hasLucideIcon = (name) => {
  const exact = lucideIcons[name];
  if (exact) return true;
  return Boolean(lucideIcons[toLucideComponentName(name)]);
};

const iconUsage = new Map();

const recordIcon = (icon, file) => {
  const current = iconUsage.get(icon) ?? { count: 0, files: new Set() };
  current.count += 1;
  current.files.add(file);
  iconUsage.set(icon, current);
};

const walk = (value, file) => {
  if (Array.isArray(value)) {
    value.forEach((entry) => walk(entry, file));
    return;
  }

  if (!value || typeof value !== 'object') {
    return;
  }

  for (const [key, child] of Object.entries(value)) {
    if (key === 'icon' && typeof child === 'string') {
      recordIcon(child, file);
    }
    walk(child, file);
  }
};

const lectureFiles = readdirSync(DATA_DIR).filter((file) => /^lecture-.*\.json$/.test(file)).sort();
lectureFiles.forEach((file) => {
  const json = JSON.parse(readFileSync(join(DATA_DIR, file), 'utf8'));
  walk(json, file);
});

const usedIcons = [...iconUsage.keys()].sort();
const emojiIcons = usedIcons.filter(isEmoji);
const unmappedEmoji = emojiIcons.filter((icon) => !iconsConfig.emojiToLucide[icon] && !allowedEmojiFallbacks.has(icon));
const preservedEmojiFallbacks = emojiIcons.filter((icon) => allowedEmojiFallbacks.has(icon));
const invalidLucideMappings = Object.entries(iconsConfig.emojiToLucide)
  .filter(([, lucideName]) => !hasLucideIcon(lucideName))
  .map(([emoji, lucideName]) => ({ emoji, lucideName }));
const missingBrandAssets = iconsConfig.brandIcons
  .filter((brand) => !existsSync(join(ICONS_DIR, `${brand}.svg`)));

const topIcons = [...iconUsage.entries()]
  .sort((a, b) => b[1].count - a[1].count || a[0].localeCompare(b[0]))
  .slice(0, 15)
  .map(([icon, meta]) => `${icon} (${meta.count})`);

console.log(`Lecture files: ${lectureFiles.length}`);
console.log(`Unique icon values: ${usedIcons.length}`);
console.log(`Emoji-like icon values: ${emojiIcons.length}`);
console.log(`Allowed raw emoji fallbacks: ${preservedEmojiFallbacks.length}`);
console.log(`Top icons: ${topIcons.join(', ')}`);

if (preservedEmojiFallbacks.length > 0) {
  console.log(`Preserved emoji fallbacks: ${preservedEmojiFallbacks.join(', ')}`);
}

if (invalidLucideMappings.length > 0) {
  console.error('\nInvalid emojiToLucide mappings:');
  invalidLucideMappings.forEach(({ emoji, lucideName }) => {
    console.error(`- ${emoji} -> ${lucideName}`);
  });
}

if (missingBrandAssets.length > 0) {
  console.error('\nMissing brand SVG assets:');
  missingBrandAssets.forEach((brand) => {
    console.error(`- ${brand} (${join(ICONS_DIR, `${brand}.svg`)})`);
  });
}

if (unmappedEmoji.length > 0) {
  console.error('\nUnmapped emoji icons:');
  unmappedEmoji.forEach((icon) => {
    const meta = iconUsage.get(icon);
    const files = [...meta.files].sort().join(', ');
    console.error(`- ${icon} (${meta.count}) in ${files}`);
  });
}

if (invalidLucideMappings.length > 0 || missingBrandAssets.length > 0 || unmappedEmoji.length > 0) {
  process.exit(1);
}

console.log('\n✅ icon coverage check passed.');
