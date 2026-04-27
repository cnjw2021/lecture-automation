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

| Design area from #69 | Current status | Evidence | Next action |
|---|---|---|---|
| Typography, color, elevation, radius tokens | Inherited | `config/video.json` defines theme tokens; `packages/remotion/src/theme.ts` exposes typed accessors. | Keep as the shared source of truth. Do not add ad hoc per-component style constants. |
| Semantic motion presets | Inherited | `config/video.json` defines `emphasis`, `sequential`, `flow`; `packages/remotion/src/animation.ts` resolves semantic and component presets. | Use these presets in component work; avoid adding local spring values unless a component needs a documented exception. |
| Icon and brand asset layer | Inherited with gaps | `config/icons.json`, `resolveIcon.ts`, `NodeIcon.tsx`, public brand SVGs, and `scripts/icon-coverage-check.mjs` exist. | Continue reducing raw emoji fallback. Add missing brand assets only when recurring lecture scenes need them. |
| `NodeIcon` variants | Inherited | `brand-original`, `brand-tinted`, `lucide-accent`, `lucide-muted`, `highlighted` are implemented. | Document variant choice in component-specific improvements instead of expanding variants now. |
| Illustration and backdrop layer | Partially inherited | `DecorativeBackdrop` and `IllustrationPanel` exist, but `packages/remotion/public/illustrations` only contains `SOURCES.md`. | Treat illustrations as optional polish. Do not make JSON conversion depend on missing illustration assets. |
| Shared infographic primitives | Inherited | `InfographicPanel`, `MetricBadge`, `SectionEyebrow`, `ConnectorLabel`, `DecorativeBackdrop`, `IllustrationPanel` exist. | #126 should verify high-usage components use these primitives consistently. |
| Component redesign | Partially inherited | Many components import shared primitives, but current JSON still relies heavily on headline/list components. | Pilot improvements should focus on `KeyPointScreen`, `CalloutScreen`, `DefinitionScreen`, `BulletDetailScreen`, `SummaryScreen`. |
| Props schema validation | Inherited | `REMOTION_PROPS_SCHEMAS` and `validateRemotionVisualProps` exist; `ValidateLectureUseCase` runs schema validation in warning mode. | Keep warning mode for existing assets; use strict validation for targeted new or regenerated lectures. |
| No-audio preview path | Inherited | `PreviewRoot.tsx` and `scripts/preview-motion.mjs` provide no-audio preview separate from production audio compositions. | Use this path for before/after stills and motion previews in #126. |
| Visual style preset system | Needs separate decision | `activeTemplate` currently selects a global template, and #128 tracks global/scene-level style decisions. | Do not add scene-level `stylePreset` until #128 resolves scope and migration cost. |

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

## Recommended next priority

1. Use this audit as the #125 baseline.
2. Start #126 with `KeyPointScreen` and `CalloutScreen`, then verify whether `SummaryScreen` is being overused for non-summary lists.
3. Feed the risky cases above into #127, especially annotated code/render pairs and tool-catalog comparisons.
4. Keep #128 separate; style presets should not block the component pilot.
