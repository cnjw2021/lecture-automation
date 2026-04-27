# JSON information density comparison

Related: #122, #123, #126, #127

Date: 2026-04-27

## Scope

Sample lecture: `data/lecture-02-02.json` (テキストを扱うタグ).

This comparison validates the #123 rule that `visual.props` should preserve learning information structure, not just summarize narration. Narration text was not changed. Only Remotion `visual` choices and props were reconverted.

Rendered still output directory: `/tmp/review/issue-123-info-density`.

## Before / after stills

| Scene | Before still | After still | Reference comparison target |
|---:|---|---|---|
| 6 | `/tmp/review/issue-123-info-density/before-scene-6.png` | `/tmp/review/issue-123-info-density/after-scene-6.png` | NotebookLM-style concept map: term → structure → browser/search interpretation |
| 10 | `/tmp/review/issue-123-info-density/before-scene-10.png` | `/tmp/review/issue-123-info-density/after-scene-10.png` | Progate-style contrast slide: code whitespace vs rendered browser output |
| 17 | `/tmp/review/issue-123-info-density/before-scene-17.png` | `/tmp/review/issue-123-info-density/after-scene-17.png` | MDN/Progate-style decision slide: unordered list vs ordered list use cases |

## Scene decisions

| Scene | Before | After | Information units retained after reconversion |
|---:|---|---|---|
| 6 | `KeyPointScreen` | `DiagramScreen` | heading tag examples, document hierarchy, browser interpretation, search engine interpretation, usage criterion |
| 10 | `CalloutScreen` | `ComparisonScreen` | code-side whitespace, human readability, browser rendering behavior, tag-based line break rule, `br` bridge |
| 17 | `QnAScreen` | `ComparisonScreen` | `ul` use cases, `ol` use cases, marker behavior, order-as-information criterion, default choice when unsure |

## #123 criteria check

| Criterion | Result |
|---|---|
| Audio dependency | Improved. Each changed still now contains the core rule plus examples or decision criteria, so the scene can be partially reconstructed without narration. |
| Simultaneous information units | All three changed scenes retain at least 4 durable information units in `visual.props`. |
| Narration-screen complement | The screen now turns sequential narration into a relationship diagram or decision comparison instead of repeating the conclusion sentence. |
| Short-slide exception | None of the three sampled scenes qualified for a short-slide exception because each narration contained multiple concepts and practical criteria. |
| Reference comparison | The after stills can be compared against concept-map and contrast-slide references without the immediate "headline plus one sentence" gap. |

## Component boundary notes

No new component was required for these samples. Existing `DiagramScreen` and `ComparisonScreen` were sufficient for the selected information structures.

Keep the following as #127 territory when they appear in future conversions:

- code line ↔ rendered result mapping
- HTML tree ↔ page region mapping
- Flexbox axis / wrap / distribution diagrams
- selector ↔ DOM match visualization

Until those components are active, lecture JSON must continue to use existing components and record the missing structure as a follow-up instead of using candidate component names.

## Verification

- `jq empty data/lecture-02-02.json`
- `npx tsx packages/automation/src/presentation/cli/validate-lecture-schema.ts lecture-02-02.json --strict`
- `npx remotion compositions src/PreviewRoot.tsx`
- Rendered before/after stills for scenes 6, 10, and 17.
