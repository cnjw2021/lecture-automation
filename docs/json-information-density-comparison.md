# JSON information density comparison

Related: #122, #123, #126, #127

Date: 2026-04-27

## Scope

Sample lecture: `data/lecture-02-02.json` (テキストを扱うタグ).

This comparison validates the #123 rule that `visual.props` should preserve learning information structure, not just summarize narration. Narration text was not changed. Only Remotion `visual` choices and props were reconverted.

Committed still directory: `docs/assets/issue-123/`.

Temporary render working directory used during review: `/tmp/review/issue-123-info-density`.

## Before / after stills

| Scene | Before still | After still | Reference comparison target |
|---:|---|---|---|
| 6 | `docs/assets/issue-123/before-scene-6.png` | `docs/assets/issue-123/after-scene-6.png` | MDN heading usage notes: heading levels, no text-resize misuse, no skipped levels |
| 10 | `docs/assets/issue-123/before-scene-10.png` | `docs/assets/issue-123/after-scene-10.png` | MDN whitespace handling: code readability whitespace vs browser whitespace processing |
| 17 | `docs/assets/issue-123/before-scene-17.png` | `docs/assets/issue-123/after-scene-17.png` | MDN list usage notes: order meaningful → `ol`, otherwise `ul` |

### Scene 6

| Before | After |
|---|---|
| ![before scene 6](assets/issue-123/before-scene-6.png) | ![after scene 6](assets/issue-123/after-scene-6.png) |

### Scene 10

| Before | After |
|---|---|
| ![before scene 10](assets/issue-123/before-scene-10.png) | ![after scene 10](assets/issue-123/after-scene-10.png) |

### Scene 17

| Before | After |
|---|---|
| ![before scene 17](assets/issue-123/before-scene-17.png) | ![after scene 17](assets/issue-123/after-scene-17.png) |

## External reference sources

Third-party screenshots are not committed in this repository. Instead, this sheet keeps stable reference URLs and compares against the information structures visible in those public references.

| Scene | Reference source | Structure used as comparison target |
|---:|---|---|
| 6 | MDN [`<h1>-<h6>` heading elements](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/Heading_Elements) | six heading levels, page hierarchy, accessibility/navigation, "do not use headings to resize text" |
| 10 | MDN [Handling whitespace](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_text/Whitespace) | whitespace characters used for code readability vs processing in rendered output |
| 17 | MDN [`<ol>` element](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/ol), MDN [`<ul>` element](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/ul) | ordered list meaning, unordered list meaning, reorder test for choosing `ol` vs `ul` |

## Scene decisions

| Scene | Before | After | Information units retained after reconversion |
|---:|---|---|---|
| 6 | `KeyPointScreen` | `DiagramScreen` | heading tag examples, document hierarchy, browser interpretation, search engine interpretation, usage criterion |
| 10 | `CalloutScreen` | `ComparisonScreen` | code-side whitespace, human readability, browser rendering behavior, tag-based line break rule, `br` bridge |
| 17 | `QnAScreen` | `ComparisonScreen` | `ul` use cases, `ol` use cases, marker behavior, order-as-information criterion, default choice when unsure |

## #123 criteria check

Information unit scoring follows `docs/json-conversion-rules.md`: independent nodes/cards/points count as 1 unit; relationship labels and short captions count only when they add a distinct relation or take-away.

| Scene | Narration core units | Still-recoverable units | Recovery |
|---:|---:|---:|---:|
| 6 | 6 | 5 | 83% |
| 10 | 5 | 5 | 100% |
| 17 | 6 | 5 | 83% |

| Criterion | Result |
|---|---|
| Audio dependency | Pass. All changed scenes exceed the 70% still-recovery threshold. |
| Simultaneous information units | Pass. All three changed scenes retain at least 5 still-recoverable information units. |
| Narration-screen complement | Pass. The screen turns sequential narration into a relationship diagram or decision comparison instead of repeating the conclusion sentence. |
| Short-slide exception | Pass. None of the three sampled scenes qualified for a short-slide exception because each narration contained multiple concepts and practical criteria. |
| Reference comparison | Partial but documented. Project stills are committed; external reference screenshots are not committed, but stable MDN URLs and comparison structures are recorded above. |

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

Still reproduction commands:

```bash
mkdir -p /tmp/review/issue-123-info-density
git show 0b9da9c:data/lecture-02-02.json > /tmp/review/issue-123-info-density/lecture-02-02-before.json
jq -n --slurpfile lecture /tmp/review/issue-123-info-density/lecture-02-02-before.json '{lectureData:$lecture[0],sceneId:6,durationInFrames:120}' > /tmp/review/issue-123-info-density/before-scene-6-props.json
npx remotion still src/PreviewRoot.tsx PreviewScene /tmp/review/issue-123-info-density/before-scene-6.png --frame=60 --props=/tmp/review/issue-123-info-density/before-scene-6-props.json
```

`0b9da9c` is the PR base commit used for the before JSON. Use the same pattern with `sceneId` 10 and 17 for before stills, and `data/lecture-02-02.json` for after stills. The committed PNGs in `docs/assets/issue-123/` are the canonical comparison artifacts for this PR.

Committed stills were downscaled to 960x540 and compressed with `pngquant --quality=70-90` to keep comparison assets small enough for git history.
