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
- Locale or character-specific symbols such as `🇯🇵`, `🐸`, `💆`, `🧘`
  - Reason: broad semantic remapping created more meaning loss than keeping the original emoji.

These exceptions are tracked in `config/icons.json > allowedEmojiFallbacks` and are treated as valid by `scripts/icon-coverage-check.mjs`.

## Current Assets

| asset | source | license | modifications | attribution | notes |
|---|---|---|---|---|---|
| `claude.svg` | existing repo asset | pending audit | existing file | not recorded yet | backfill exact upstream URL before adding new variants |
| `chatgpt.svg` | existing repo asset | pending audit | existing file | not recorded yet | backfill exact upstream URL before adding new variants |
| `cursor.svg` | existing repo asset | pending audit | existing file | not recorded yet | backfill exact upstream URL before adding new variants |
| `v0.svg` | existing repo asset | pending audit | existing file | not recorded yet | backfill exact upstream URL before adding new variants |
| `github.svg` | https://github.com/simple-icons/simple-icons/blob/HEAD/icons/github.svg | CC0-1.0 | 48×48 rounded-rect wrapper, white icon | not required | GitHub Octocat mark |
| `netlify.svg` | https://github.com/simple-icons/simple-icons/blob/HEAD/icons/netlify.svg | CC0-1.0 | 48×48 rounded-rect wrapper, white icon | not required | Netlify brand |
| `figma.svg` | https://github.com/simple-icons/simple-icons/blob/HEAD/icons/figma.svg | CC0-1.0 | 48×48 rounded-rect wrapper, white icon | not required | Figma brand |
| `stackblitz.svg` | https://github.com/simple-icons/simple-icons/blob/HEAD/icons/stackblitz.svg | CC0-1.0 | 48×48 rounded-rect wrapper, white icon | not required | StackBlitz brand |
| `chrome.svg` | https://github.com/simple-icons/simple-icons/blob/HEAD/icons/googlechrome.svg | CC0-1.0 | 48×48 rounded-rect wrapper, white icon | not required | Google Chrome brand |
| `html5.svg` | https://github.com/simple-icons/simple-icons/blob/HEAD/icons/html5.svg | CC0-1.0 | 48×48 rounded-rect wrapper, white icon | not required | HTML5 mark |
| `css3.svg` | https://github.com/simple-icons/simple-icons/blob/HEAD/icons/css.svg | CC0-1.0 | 48×48 rounded-rect wrapper, white icon | not required | CSS brand (simple-icons renamed css3→css) |
| `codepen.svg` | hand-drawn based on CodePen diamond logo | informational display | simplified from public mark | not required | original css3 removed from simple-icons |
| `vscode.svg` | https://github.com/simple-icons/simple-icons/blob/HEAD/icons/visualstudiocode.svg | CC0-1.0 | 48×48 rounded-rect wrapper, white icon | not required | VS Code icon path |
| `canva.svg` | hand-drawn Canva "C" lettermark | informational display | simplified circular mark | not required | canva.svg removed from simple-icons |

## Intake Template

Fill this table for every new SVG before it is committed.

| asset | source URL | license | modifications | attribution | notes |
|---|---|---|---|---|---|
| example.svg | https://simpleicons.org/?q=example | CC0-1.0 | single-tone export only | not required | verify trademark-safe placement in lecture scenes |
