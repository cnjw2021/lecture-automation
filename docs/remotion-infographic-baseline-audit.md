# Remotion infographic baseline audit

Related: #122, #125, #69

Date: 2026-04-27

## Scope

This audit records the current baseline before adding more visual planning rules.
It does not replace `docs/remotion-infographic-enhancement-design.md`; it checks how much of that design is already reflected in the current code and lecture JSON.

Inputs checked:

- `docs/remotion-infographic-enhancement-design.md`
- `config/video.json`
- `packages/remotion/src/**`
- `packages/automation/src/domain/validation/**`
- `scripts/icon-coverage-check.mjs`
- `data/lecture-*.json`

## #69 implementation status

Status labels: `계승`, `보완 필요`, `미구현`, `폐기 권장`.
All audited design areas are at least partially reflected in the current implementation, so this pass found no `미구현` or `폐기 권장` items.

| Design area from #69 | Status | Evidence | Next action |
|---|---|---|---|
| Typography, color, elevation, radius tokens | 계승 | `config/video.json` defines theme tokens; `packages/remotion/src/theme.ts` exposes typed accessors. | Keep as the shared source of truth. Do not add ad hoc per-component style constants. |
| Semantic motion presets | 계승 | `config/video.json` defines `emphasis`, `sequential`, `flow`; `packages/remotion/src/animation.ts` resolves semantic and component presets. | Use these presets in component work; avoid adding local spring values unless a component needs a documented exception. |
| Icon and brand asset layer | 보완 필요 | `config/icons.json`, `resolveIcon.ts`, `NodeIcon.tsx`, public brand SVGs, and `scripts/icon-coverage-check.mjs` exist. Raw emoji fallback and missing brand/source coverage still require audit. | Continue reducing raw emoji fallback. Add missing brand assets only when recurring lecture scenes need them. |
| `NodeIcon` variants | 계승 | `brand-original`, `brand-tinted`, `lucide-accent`, `lucide-muted`, `highlighted` are implemented. | Document variant choice in component-specific improvements instead of expanding variants now. |
| Illustration and backdrop layer | 보완 필요 | `DecorativeBackdrop` and `IllustrationPanel` exist, but `packages/remotion/public/illustrations` only contains `SOURCES.md`. | Treat illustrations as optional polish. Do not make JSON conversion depend on missing illustration assets. |
| Shared infographic primitives | 계승 | `InfographicPanel`, `MetricBadge`, `SectionEyebrow`, `ConnectorLabel`, `DecorativeBackdrop`, `IllustrationPanel` exist. | #126 should verify high-usage components use these primitives consistently. |
| Component redesign | 보완 필요 | Many components import shared primitives, but current JSON still relies heavily on headline/list components. | Pilot improvements should focus on `KeyPointScreen`, `CalloutScreen`, `DefinitionScreen`, `BulletDetailScreen`, `SummaryScreen`. |
| Props schema validation | 계승 | `REMOTION_PROPS_SCHEMAS` and `validateRemotionVisualProps` exist; `ValidateLectureUseCase` runs schema validation in warning mode. | Keep warning mode for existing assets; use strict validation for targeted new or regenerated lectures. |
| No-audio preview path | 계승 | `PreviewRoot.tsx` and `scripts/preview-motion.mjs` provide no-audio preview separate from production audio compositions. | Use this path for before/after stills and motion previews in #126. |
| Visual style preset system | 보완 필요 | `activeTemplate` currently selects a global template, and #128 tracks global/scene-level style decisions. | Do not add scene-level `stylePreset` until #128 resolves scope and migration cost. |

## Component usage baseline

Dataset: 25 files matching `data/lecture-*.json`.

Visual type counts:

| Visual type | Count |
|---|---:|
| `remotion` | 883 |
| `playwright` | 38 |

Component counts:

| Component | Count |
|---|---:|
| `KeyPointScreen` | 143 |
| `MyCodeScene` | 128 |
| `CalloutScreen` | 103 |
| `DefinitionScreen` | 52 |
| `BulletDetailScreen` | 43 |
| `SummaryScreen` | 43 |
| `NumberedListScreen` | 35 |
| `TwoColumnScreen` | 34 |
| `IconListScreen` | 30 |
| `CodeWalkthroughScreen` | 30 |
| `BrowserMockScreen` | 26 |
| `TitleScreen` | 25 |
| `EndScreen` | 25 |
| `AgendaScreen` | 23 |
| `ProgressScreen` | 23 |
| `ComparisonScreen` | 22 |
| `QuoteScreen` | 21 |
| `QnAScreen` | 20 |
| `BeforeAfterScreen` | 16 |
| `DiagramScreen` | 9 |
| `FeatureGridScreen` | 8 |
| `StatScreen` | 8 |
| `SectionBreakScreen` | 5 |
| `HierarchyScreen` | 5 |
| `TimelineScreen` | 3 |
| `ImageScreen` | 2 |
| `BarChartScreen` | 1 |

Interpretation:

- The baseline is dominated by explanatory screens, not data/relationship screens.
- The top five explanation components plus `MyCodeScene` account for most slide volume.
- Existing JSON already has a broad component palette, but visual planning often chooses text/list components for scenes that have a clearer structural pattern.

## Representative scene baseline

| Scene | Current component | Baseline assessment |
|---|---|---|
| `lecture-01-02.json` scene 4 | `BrowserMockScreen` | Appropriate. The narration introduces the browser address bar concept without requiring live operation. |
| `lecture-01-02.json` scene 6 | `DiagramScreen` | Appropriate for browser/server request-response. DNS is omitted here, which keeps the scene readable but means later DNS scenes must carry that relation. |
| `lecture-01-02.json` scene 10 | `DefinitionScreen` | Appropriate. Term, reading, definition, and numeric example match the component's information structure. |
| `lecture-01-02.json` scene 15 | `BrowserMockScreen` | Appropriate. The HTTPS lock mark is a browser UI concept, and a mock is sufficient. |
| `lecture-01-02.json` scene 25 | `BulletDetailScreen` | Appropriate. HTML/CSS/JavaScript roles are parallel items and fit a 3-item detail layout. |
| `lecture-01-03.json` scene 10 | `SummaryScreen` | Semantically loose. The props are not a summary; they are prompt constraints. A structured list or callout pattern would make the intent clearer. |
| `lecture-01-03.json` scene 23 | `BulletDetailScreen` | Mostly appropriate. It compares tool candidates, but a comparison/tool catalog pattern could express constraints more clearly. |
| `lecture-01-03.json` scene 37 | `DiagramScreen` | Appropriate. The scene describes a 3-step production loop and current props map cleanly to nodes and edges. |
| `lecture-02-03.json` scene 11 | `CodeWalkthroughScreen` | Appropriate. The narration explains the `href` attribute inside a concrete code snippet. |
| `lecture-02-03.json` scene 13 | `DiagramScreen` | Risky. The topic is inline tag structure, so an annotated code/syntax pattern would be more direct than spatial nodes. |
| `lecture-03-01.json` scene 32 | `DiagramScreen` | Risky. CSS syntax is currently modeled as nodes, but the source concept is code grammar and should usually stay near code. |

## Reference slide comparison sheet

Reference images are not copied into this repository. Use the source links and captions below as the reference side of the comparison, and render the project stills from the listed lecture/scene ids when doing visual review.
This comparison is a planning-level gap map: actual reference-vs-project still review should be performed in #126 while rendering the vertical slice stills, and the audio dependency percentages below should be re-measured from those rendered stills.

Quality criteria from #122:

- `Info units`: how many durable information units are visible at once.
- `Hierarchy`: whether the most important relation is visually dominant.
- `Audio dependency`: estimated share of the core idea that can be reconstructed from still only.
- `Narration complement`: whether the screen adds structure beyond summarizing narration.
- `Palette limit`: whether the current component palette blocks the reference structure.

| Reference | Topic | Project still candidate | #122 gap assessment |
|---|---|---|---|
| [NotebookLM Video Overviews help](https://support.google.com/notebooklm/answer/16758265) | Benchmark for generated explanatory visuals | `lecture-01-03.json` scene 37, `DiagramScreen`, "Web制作の新しい流れ" | Info units: 3 nodes + 2 edges is sufficient. Hierarchy: medium. Audio dependency: about 45%; labels preserve the sequence, but "review quality" criteria stay in narration. Narration complement: moderate. Palette limit: no freeform diagram annotations or mixed media panels. |
| [MDN: An overview of HTTP](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Overview) | HTTP request-response / browser-server relation | `lecture-01-02.json` scene 6, `DiagramScreen`, "ブラウザとサーバーのやりとり" | Info units: 2 actors + 2 edges. Hierarchy: request/response is visible, but URL/DNS/server file lookup is split across scenes. Audio dependency: about 50%. Narration complement: low-medium. Palette limit: cannot layer protocol steps over browser/address/server context in one screen. |
| [MDN: Headings and paragraphs](https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Structuring_content/Headings_and_paragraphs) | Heading hierarchy and document outline | `lecture-02-02.json` scene 5, `HierarchyScreen`, "見出しの階層構造" | Info units: hierarchy is visible. Hierarchy: strong for parent/child, weak for rendered page result. Audio dependency: about 35%. Narration complement: medium. Palette limit: cannot show heading tree and rendered page side by side. |
| [MDN: The box model](https://developer.mozilla.org/en-US/docs/Learn/CSS/Building_blocks/The_box_model) | Content, padding, border, margin layers | `lecture-03-04.json` scene 5 and scene 20, `BulletDetailScreen`, box model layer lists | Info units: four layers exist as text items. Hierarchy: weak because spatial nesting is not visible. Audio dependency: about 65%; the viewer must imagine the nested boxes. Narration complement: low. Palette limit: no layered box/cross-section component, no DevTools-style overlay. |
| [MDN: Flexbox](https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/CSS_layout/Flexbox) | Container, item, main axis, cross axis | `lecture-03-05.json` scene 7 and scene 9, `TwoColumnScreen`, "コンテナとアイテム" / "主軸と交差軸" | Info units: terminology is present. Hierarchy: medium for pairs, weak for axis geometry. Audio dependency: about 60%; movement and axis swap are narration-dependent. Narration complement: low-medium. Palette limit: no axis overlay, item distribution, or before/after layout state in one component. |
| [MDN: CSS selectors](https://developer.mozilla.org/en-US/docs/Learn/CSS/Building_blocks/Selectors) | Selector tokens mapped to matching elements | `lecture-03-02.json` scenes 27-29, `BulletDetailScreen` / `SummaryScreen`, selector summaries | Info units: names and rules are visible. Hierarchy: weak for matching behavior. Audio dependency: about 70%; the viewer must infer which DOM nodes match. Narration complement: low. Palette limit: no selector-to-DOM matching visualization. |
| [Progate HTML & CSS course](https://progate.com/courses/html) | Beginner lesson style: code, result, and task progression | `lecture-02-01.json` scene 18, `MyCodeScene`, "HTMLの基本構造" | Info units: code is visible. Hierarchy: code only; rendered result is absent. Audio dependency: about 55%. Narration complement: low. Palette limit: no code/result split screen with highlighted line-to-output mapping. |

## Visual structures outside the current palette

These are not merely weak component choices; they are structures that the current top-level component palette cannot express well even if the converter chooses carefully.

| Visual structure | Concrete source scene | Why current components fall short | Variant enough? | #127 follow-up candidate |
|---|---|---|---|---|
| Code line to rendered result mapping | `lecture-02-01.json` scene 18, `lecture-02-03.json` scene 13, `lecture-03-01.json` scene 32 | `MyCodeScene` shows code only, `DiagramScreen` abstracts code into spatial nodes, and `CodeWalkthroughScreen` highlights lines without showing rendered output. | No. This needs a split code/result layout with callouts connecting line ranges to visible output regions. | New candidate: `CodeRenderMappingScreen` or a code/browser paired pattern. |
| HTML tree plus page result side by side | `lecture-02-02.json` scene 5, `lecture-02-07.json` scene 11 | `HierarchyScreen` can show the tree, and `BrowserMockScreen` can show a page-like frame, but not both with linked highlights. | Probably no. A generic `TwoColumnScreen` lacks structural connectors and live highlight semantics. | New candidate: `StructureToRenderScreen`. |
| CSS box model as nested spatial layers | `lecture-03-04.json` scenes 5, 6, 20 | `BulletDetailScreen` lists content/padding/border/margin, but the concept is spatial. The learner needs nested rectangles, labels, dimensions, and possibly DevTools color semantics. | Partial. Could extend an existing diagram component, but coordinate authoring would be brittle. | New candidate: `BoxModelDiagramScreen` or domain pattern under #127. |
| Flexbox axis and item distribution | `lecture-03-05.json` scenes 7, 9, 14, 20, 21, 24, 27 | `TwoColumnScreen` explains pairs, `MyCodeScene` shows CSS, but neither shows main/cross axis direction, item movement, wrapping, and before/after distribution. | No for the full pattern; maybe a small variant for static axis labels. | New candidate: `FlexLayoutDiagramScreen`. |
| Selector-to-DOM matching map | `lecture-03-02.json` scenes 15, 19, 23, 27-31 | The current palette can list selector types or show code, but it cannot show `.class` / `#id` / descendant selector tokens pointing to matching DOM nodes. | Partial for simple selectors; not enough for descendant/combinator cases. | New candidate: `SelectorMatchScreen` or an annotated DOM tree pattern. |

## Stable conversion scope

The current converter can choose reliably when the scene maps to one of these shapes:

- A single concept or warning: `KeyPointScreen`, `CalloutScreen`, `DefinitionScreen`
- Parallel facts or roles: `BulletDetailScreen`, `IconListScreen`, `NumberedListScreen`
- Simple process or relation: `DiagramScreen`, `TimelineScreen`, `ProgressScreen`
- Concrete code explanation: `MyCodeScene`, `CodeWalkthroughScreen`
- Browser concept without live operation: `BrowserMockScreen`, `ImageScreen`
- Actual operation: `playwright`

The converter is more likely to make weak choices when:

- A list is not actually a summary, but `SummaryScreen` is used because it accepts simple strings.
- Code grammar or inline syntax is converted into a generic diagram.
- Tool candidates with constraints are represented as generic bullet cards instead of a comparison/catalog pattern.
- Visual props keep only the headline while the narration contains two or more durable on-screen facts.
- Multiple adjacent scenes reuse `KeyPointScreen` or `CalloutScreen` even though the underlying information shape changes.

## Visual planning draft

Before writing `visual.component`, answer these questions in order. Stop as soon as a question determines the visual type.

1. Does the audience need to see an actual browser or AI-tool operation happen? If yes, use `type: "playwright"`; if a static browser state is enough, use `BrowserMockScreen` or `ImageScreen`.
2. Is the core object code syntax, a rendered/browser UI, a process/relationship, a comparison, or a list of parallel facts? Pick the component family from that object, not from the sentence style.
3. Which facts must remain on screen without relying on narration: one concept, two-sided contrast, 3-5 parallel items, or a flow? Choose props that preserve those facts.
4. Is the scene using `SummaryScreen` only because it accepts simple strings? If the list is an instruction set, prompt constraints, tool candidates, or role breakdown, use a more specific list/detail/comparison component.
5. Would this create the third adjacent scene with the same component or the same visual rhythm? If yes, switch to a compatible component that matches the information shape.
6. Does the scene require one of the out-of-palette structures above, such as code/result mapping, DOM-to-render pairing, box model layers, Flexbox axes, or selector matching? If yes, choose the least misleading existing component and mark the case for #127 instead of forcing a generic diagram.

## #126 vertical slice recommendation

Primary recommendation: `lecture-03-04.json` (box model).

Reason:

- Usage and blast radius: it uses `KeyPointScreen`, `DefinitionScreen`, `BulletDetailScreen`, `TwoColumnScreen`, `BrowserMockScreen`, `CalloutScreen`, `IconListScreen`, `MyCodeScene`, and `CodeWalkthroughScreen`.
- Gap size: the core concept is spatial, but the current baseline is mostly text cards and code snippets.
- Reference match: MDN's box model material gives a clear benchmark for nested layers and DevTools-style color semantics.
- #126 fit: the vertical slice can improve high-usage explanation components first while exposing a concrete #127 candidate for a dedicated box-model pattern.
- Dependency note: #126 may include a small box-model visual prototype if needed for the vertical slice, but the reusable `BoxModelDiagramScreen` decision and final pattern ownership should remain in #127.

Secondary recommendation: `lecture-03-05.json` (Flexbox).

Reason:

- Usage and blast radius: it stresses `KeyPointScreen`, `DefinitionScreen`, `TwoColumnScreen`, `MyCodeScene`, `NumberedListScreen`, `IconListScreen`, and `CalloutScreen`.
- Gap size: main/cross axes, wrapping, and distribution changes are hard to understand from still text without a layout diagram.
- #127 bridge: it can produce a focused decision on whether Flexbox should be a new top-level component or a reusable domain diagram pattern.

## Recommended next priority

1. Use this audit as the #125 baseline and gap map.
2. Start #126 with `lecture-03-04.json` as the vertical slice, then include `lecture-03-05.json` if the pilot has room for a second slice.
3. Feed the out-of-palette structures above into #127, especially code/result mapping, box model layers, Flexbox axes, and selector matching.
4. Keep #128 separate; style presets should not block the component pilot.
