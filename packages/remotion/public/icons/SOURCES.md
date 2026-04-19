# Icon Sources

Updated: 2026-04-19

## Policy

- Primary source for brand and technology logos: `Simple Icons`
- Upstream license: `CC0-1.0`
- Allowed use: informational logo display inside lecture scenes
- Do not imply sponsorship, partnership, or certification
- Do not distort official proportions or shapes
- `brand-tinted` variants may only change a logo to a single-tone treatment

## Raw Emoji Exceptions

Some icons intentionally stay as raw emoji instead of being force-mapped to Lucide.

- Color-only symbols such as `🔴`, `🔵`, `🟠`, `🟡`, `🟢`, `⚫`, `⚪`, `🟫`
  - Reason: the color itself is the meaning, and Lucide replacement loses that signal.
- Locale or character-specific symbols such as `🇯🇵`, `🐸`, `🐙`, `💆`, `🧘`
  - Reason: broad semantic remapping created more meaning loss than keeping the original emoji.

These exceptions are tracked in `config/icons.json > allowedEmojiFallbacks` and are treated as valid by `scripts/icon-coverage-check.mjs`.

## Current Assets

| asset | source | license | modifications | attribution | notes |
|---|---|---|---|---|---|
| `claude.svg` | existing repo asset | pending audit | existing file | not recorded yet | backfill exact upstream URL before adding new variants |
| `chatgpt.svg` | existing repo asset | pending audit | existing file | not recorded yet | backfill exact upstream URL before adding new variants |
| `cursor.svg` | existing repo asset | pending audit | existing file | not recorded yet | backfill exact upstream URL before adding new variants |
| `v0.svg` | existing repo asset | pending audit | existing file | not recorded yet | backfill exact upstream URL before adding new variants |

## Intake Template

Fill this table for every new SVG before it is committed.

| asset | source URL | license | modifications | attribution | notes |
|---|---|---|---|---|---|
| example.svg | https://simpleicons.org/?q=example | CC0-1.0 | single-tone export only | not required | verify trademark-safe placement in lecture scenes |
