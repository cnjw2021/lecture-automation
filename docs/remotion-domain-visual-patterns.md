# Remotion domain visual patterns

Related: #122, #125, #126, #127

Date: 2026-04-27

## Purpose

This document converts the visual gaps from `docs/remotion-infographic-baseline-audit.md` into component-level decisions.
It is the #127 handoff point for HTML/CSS/Web production lesson visuals that the current generic slide palette cannot express well.

Important boundary:

- `BoxModelDiagramScreen` is implemented and may be used in lecture JSON.
- The other named screens in this document are candidate specs. Do not use them in production lecture JSON until they are implemented, exported, registered in `REMOTION_PROPS_SCHEMAS`, and added to `docs/component-props-reference.md` as active components.

## Pattern Decision Table

| Pattern | Current gap source | Decision | Component / variant | Reason |
|---|---|---|---|---|
| Code line to rendered result mapping | `lecture-02-01.json` scene 18, `lecture-02-03.json` scene 13, `lecture-03-01.json` scene 32 | New top-level candidate | `CodeRenderMappingScreen` | `CodeWalkthroughScreen` can highlight code lines, but it cannot keep the rendered browser result and line-to-result connectors on screen. `TwoColumnScreen` lacks code semantics and stable highlight mapping. |
| HTML tree plus page result side by side | `lecture-02-02.json` scene 5, `lecture-02-07.json` scene 11 | New top-level candidate | `StructureToRenderScreen` | `HierarchyScreen` shows structure and `BrowserMockScreen` shows output, but neither can link tree nodes to rendered regions. A generic diagram would hide the HTML-to-page relation. |
| CSS box model nested layers | `lecture-03-04.json` scenes 5, 6, 15, 20, 25, 28, 36 | Implemented, keep CSS-specific | `BoxModelDiagramScreen` | The #126 pilot proved that the four CSS layers, DevTools colors, and width arithmetic are recurring enough to justify a dedicated CSS component. Do not generalize this to an abstract layered-region component yet; generic names would make converter choice less precise. |
| Flexbox axis and item distribution | `lecture-03-05.json` scenes 7, 9, 14, 20, 21, 24, 27 | New top-level candidate | `FlexLayoutDiagramScreen` | Axis direction, wrapping, gap, justify/align behavior, and before/after distribution need stable layout semantics. Extending `DiagramScreen` would force brittle coordinates and miss container/item state. |
| Selector-to-DOM matching map | `lecture-03-02.json` scenes 15, 19, 23, 27-31 | New top-level candidate | `SelectorMatchScreen` | Simple selector lists fit `BulletDetailScreen`, but descendant/combinator matching needs tokens connected to DOM nodes and matched/unmatched states. |
| Browser/editor/file/search mock with annotations | Cross-cutting web production scenes | Existing component plus variant guidance | `BrowserMockScreen`, `ImageScreen`, future annotated image variant | Use an actual Playwright scene for live operation. Use Remotion only when a static browser/editor state plus labels is enough. A new component is not justified until repeated captures need region-level annotations. |
| AI tool prompt and generated result pairing | `lecture-01-03` tool workflow scenes and later AI workflow lessons | Existing component for now | `ComparisonScreen`, `BeforeAfterScreen`, `CodeRenderMappingScreen` when result is rendered UI | If the relation is prompt constraints vs output quality, use comparison/before-after. If the generated result is code producing visible output, use the code/result mapping candidate. |

## Active Component Decision

### `BoxModelDiagramScreen`

Decision: keep this as a CSS-specific component.

Why not generalize now:

- The layer vocabulary is not generic. `content`, `padding`, `border`, and `margin` are the learning target, not incidental labels.
- The colors intentionally match DevTools-like semantics. A generic layered-region component would either preserve CSS leakage or weaken the most useful mental model.
- The width formula is CSS-specific. Other layered diagrams would not share the same arithmetic.
- Existing usage is limited to `lecture-03-04.json`, so preserving a precise component name has near-zero migration cost.

Use it when the still must preserve at least two of these units:

- nested content / padding / border / margin positions
- highlighted layer focus
- DevTools color semantics
- content-box or border-box width calculation
- a concrete card/page object mapped back to the four layers

Do not use it for:

- generic inclusion diagrams
- non-CSS nested concepts
- single-term definitions where `DefinitionScreen` or `BulletDetailScreen` is enough

Representative sample:

```json
{
  "type": "remotion",
  "component": "BoxModelDiagramScreen",
  "props": {
    "title": "width: 300px の箱は実際に 344px",
    "subtitle": "content-box では padding と border が外側に足される",
    "highlightLayer": "content",
    "contentLabel": "width: 300px",
    "contentDetail": "指定した幅はコンテントだけ",
    "layers": [
      { "key": "margin", "label": "マージン", "value": "外側" },
      { "key": "border", "label": "ボーダー", "value": "2px" },
      { "key": "padding", "label": "パディング", "value": "20px" },
      { "key": "content", "label": "コンテント", "value": "300px" }
    ],
    "formula": [
      { "label": "content", "value": "300" },
      { "label": "padding L/R", "value": "40" },
      { "label": "border L/R", "value": "4" }
    ],
    "totalLabel": "344px"
  }
}
```

Reference comparison target: MDN box model and DevTools box model overlays. See `docs/lecture-03-04-box-model-vertical-slice.md` for rendered before/after stills.

## Candidate Component Specs

### `CodeRenderMappingScreen`

Responsibility: show code and rendered output at the same time, with line-range highlights connected to visible result regions.

Use when:

- the narration explains how a specific HTML/CSS line changes the page
- a code grammar concept is easier to understand by seeing its output
- `CodeWalkthroughScreen` would leave the learner imagining the result

Do not use when:

- code is being introduced for the first time with no rendered output requirement; use `MyCodeScene`
- only one or two code lines need emphasis and the result is already obvious; use `CodeWalkthroughScreen`
- the scene must show actual browser interaction; use Playwright

Proposed props:

```json
{
  "title": "h1 の行が見出しとして表示される",
  "language": "html",
  "code": "<h1>はじめてのページ</h1>\n<p>本文です</p>",
  "highlightLines": [1],
  "result": {
    "url": "http://localhost:3000",
    "html": "<h1>はじめてのページ</h1><p>本文です</p>"
  },
  "mappings": [
    {
      "lineRange": [1, 1],
      "target": "h1",
      "label": "大きな見出しになる"
    }
  ],
  "caption": "コードとブラウザ結果を同時に確認する"
}
```

Reference comparison target: Progate beginner HTML/CSS lessons where code, rendered result, and current task are visible together.

### `StructureToRenderScreen`

Responsibility: show a document/tree structure and its rendered page result side by side, with linked highlights.

Use when:

- an HTML hierarchy or document outline must be visible with the page result
- a heading/list/section structure is the concept, not just a nested tree
- the learner needs to see which structural node becomes which visual region

Do not use when:

- only the hierarchy matters; use `HierarchyScreen`
- only a browser UI state matters; use `BrowserMockScreen`
- the structure is a process flow; use `DiagramScreen` or `TimelineScreen`

Proposed props:

```json
{
  "title": "HTML の構造がページの見え方を作る",
  "tree": {
    "label": "body",
    "children": [
      { "id": "heading", "label": "h1: 見出し" },
      { "id": "paragraph", "label": "p: 本文" }
    ]
  },
  "rendered": {
    "url": "http://localhost:3000",
    "regions": [
      { "id": "heading", "label": "大きな見出し" },
      { "id": "paragraph", "label": "本文ブロック" }
    ]
  },
  "activeId": "heading"
}
```

Reference comparison target: MDN headings and paragraphs material that connects semantic structure to visible document organization.

### `FlexLayoutDiagramScreen`

Responsibility: show a flex container, items, main/cross axes, and layout state changes.

Use when:

- `display: flex`, `flex-direction`, `justify-content`, `align-items`, `gap`, or `wrap` is the learning target
- the axis direction or item distribution must be reconstructable from a still
- before/after layout states need to be compared

Do not use when:

- the scene only defines one term; use `DefinitionScreen`
- the scene compares two text concepts; use `TwoColumnScreen`
- the scene shows actual page editing; use Playwright or `CodeRenderMappingScreen` after implementation

Proposed props:

```json
{
  "title": "主軸に沿ってアイテムが並ぶ",
  "containerLabel": "display: flex",
  "direction": "row",
  "mainAxisLabel": "主軸",
  "crossAxisLabel": "交差軸",
  "items": [
    { "label": "A" },
    { "label": "B" },
    { "label": "C" }
  ],
  "properties": [
    { "name": "justify-content", "value": "center" },
    { "name": "gap", "value": "16px" }
  ],
  "mode": "single"
}
```

Reference comparison target: MDN Flexbox examples where the container, items, and axis behavior are visible together.

### `SelectorMatchScreen`

Responsibility: show selector tokens, a DOM tree, and matched/unmatched elements in one view.

Use when:

- the lesson explains class, id, type, descendant, child, or combinator selector matching
- the core question is "which element does this selector hit?"
- a still should preserve both selector syntax and DOM result

Do not use when:

- the scene only lists selector names; use `BulletDetailScreen`
- the scene only shows CSS syntax; use `CodeWalkthroughScreen`
- the selector effect must be shown on a real page; use `CodeRenderMappingScreen` after implementation

Proposed props:

```json
{
  "title": ".card p は card の中の p だけに当たる",
  "selector": ".card p",
  "tokens": [
    { "text": ".card", "role": "ancestor" },
    { "text": "p", "role": "target" }
  ],
  "dom": {
    "label": "body",
    "children": [
      {
        "label": "div.card",
        "children": [
          { "id": "match", "label": "p", "matched": true },
          { "label": "a" }
        ]
      },
      { "id": "miss", "label": "p", "matched": false }
    ]
  },
  "explanation": "card の外にある p は対象外"
}
```

Reference comparison target: MDN CSS selector materials where selector syntax and matching elements are taught together.

## Reference Comparison Matrix

| Pattern | Representative project source | Reference target | Still evidence status | #122 criteria expectation |
|---|---|---|---|---|
| `BoxModelDiagramScreen` | `lecture-03-04.json` scenes 5, 6, 15, 20, 25, 28, 36 | MDN box model, DevTools box model overlay | Implemented. Before/after still paths are listed in `docs/lecture-03-04-box-model-vertical-slice.md`. | Meets the target for spatial layers, simultaneous information units, and width arithmetic. |
| `CodeRenderMappingScreen` | `lecture-02-01.json` scene 18, `lecture-02-03.json` scene 13 | Progate HTML/CSS code/result lesson layout | Candidate only. Render still is blocked until the component is implemented. | A still should show code, rendered result, at least one line-to-result connector, and a concise caption. |
| `StructureToRenderScreen` | `lecture-02-02.json` scene 5, `lecture-02-07.json` scene 11 | MDN headings and paragraphs / document structure examples | Candidate only. Render still is blocked until the component is implemented. | A still should preserve both tree hierarchy and visible page regions with linked highlights. |
| `FlexLayoutDiagramScreen` | `lecture-03-05.json` scenes 7, 9, 14, 20, 21, 24, 27 | MDN Flexbox axis and distribution examples | Candidate only. Render still is blocked until the component is implemented. | A still should make main/cross axis, item order, and alignment state reconstructable without narration. |
| `SelectorMatchScreen` | `lecture-03-02.json` scenes 15, 19, 23, 27-31 | MDN CSS selectors examples | Candidate only. Render still is blocked until the component is implemented. | A still should show selector tokens, DOM nodes, matched state, and the reason non-matches are excluded. |
| Annotated capture/image variant | Playwright capture follow-ups across browser/editor scenes | Browser/editor screenshots with callouts | Explicitly deferred. Current `ImageScreen` and `BrowserMockScreen` remain active choices. | Add only if repeated static captures need region annotations; otherwise use existing components. |

## Playwright / Remotion Boundary

| Question | Use Playwright when... | Use Remotion when... | Reuse pattern |
|---|---|---|---|
| Does the learner need to see an operation happen? | The scene depends on clicks, typing, drag, hover, reload, DevTools opening, or timing. | A static state plus annotation explains the concept. | Capture the final browser state with Playwright, then reuse it through `ImageScreen` if annotation is enough. |
| Is the browser state external or unstable? | The live site state is part of the lesson and must be demonstrated. | The UI can be mocked or captured once. | Prefer `BrowserMockScreen` for URL/address-bar concepts to avoid network drift. |
| Is the core object a concept structure? | Rarely; only if real interaction is the concept. | Use Remotion infographic components for structure, hierarchy, mapping, comparison, and formulas. | Convert repeated static captures into domain components only after repeated use is proven. |
| Is TTS timing risky? | Use only when the operation length is stable and meaningful. | Prefer Remotion when the visual can be explained without live timing. | For high-risk demos, split into Playwright operation scene plus Remotion recap scene. |
| Can a capture become infographic input? | Capture if the real UI matters. | Annotate the capture in Remotion when the learning target is a highlighted region or relation. | Future annotated-image variant should accept regions, labels, and connectors. |

## Conversion Guardrails

1. Pick the learning object first: code, rendered UI, DOM structure, CSS layout, browser operation, or comparison.
2. Use the active component registry before candidate names. Candidate screens in this document are specs, not valid JSON components yet.
3. When a scene needs a candidate pattern that is not implemented, choose the least misleading active component and add a follow-up note. Do not force the concept into `DiagramScreen` if coordinates would hide the real relation.
4. Do not use `SummaryScreen` for prompt constraints, tool candidates, selector behavior, CSS geometry, or code/result relations just because it accepts short strings.
5. Still-review any new domain component beside a reference slide. A component is not accepted only because its props validate.
