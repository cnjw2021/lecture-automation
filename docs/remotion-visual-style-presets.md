# Remotion visual style preset system

Related: #122, #125, #126, #128

Date: 2026-04-27

## Purpose

Visual style presets are not theme variety. They are a signal for the learner's expected cognitive mode:

- concept intake
- code reading
- native browser or AI-tool observation
- comparison
- sequence tracking
- recap and memory consolidation

The preset system stays compatible with the fixed component palette and JSON props architecture. It should help a converter choose the right visual tone without forcing a full 25-lecture migration.

## Current Tone Audit

| Area | Current state | #128 decision |
|---|---|---|
| Global template | `config/video.json` has `activeTemplate: "warm-cream"` and also defines a `chalkboard` template with its own theme tokens. Current lecture rendering still uses one global active template at a time. | Treat `warm-cream` as the compatibility baseline. `chalkboard` exists, but it is not yet used for scene-level context differentiation. |
| Theme access | `packages/remotion/src/theme.ts` resolves one template at module load and exports global tokens. | Scene-level runtime token switching would require a larger Remotion context refactor. This issue does not do that. |
| Component styling | Most Remotion components import the singleton `theme` and use shared primitives such as `InfographicPanel`, `MetricBadge`, and `DecorativeBackdrop`. Some older components still use local font sizes and spacing. | Presets should first classify scene intent and guide conversion. Component-level visual differences can be implemented later by reading `stylePreset`. |
| Existing JSON | Existing 25 lectures do not need a style field. | Missing `visual.stylePreset` means `concept-calm` policy fallback. Existing JSON stays valid. |
| Validation | Component existence and Remotion props are already validated. | `ValidateLectureUseCase` now rejects unsupported `visual.stylePreset` values while leaving missing values untouched. |

## Context Classification

| Context | Learner burden | Preferred preset | Typical visual types |
|---|---|---|---|
| Concept explanation, definition, analogy, basic diagram | Receive a new idea with low noise and a clear focal point. | `concept-calm` | `KeyPointScreen`, `DefinitionScreen`, `QnAScreen`, `DiagramScreen`, `BoxModelDiagramScreen` |
| Code first appearance, syntax explanation, code walkthrough | Read exact characters and line-level emphasis. Decoration must not compete with code. | `code-focus` | `MyCodeScene`, `CodeWalkthroughScreen` |
| Browser result, live coding, AI-tool live demo, static capture | Recognize the real tool/browser state while keeping instructional framing minimal. | `demo-native` | `playwright`, `screenshot`, `BrowserMockScreen`, `ImageScreen` |
| Good/bad, before/after, tradeoff, two-sided decision | Compare two states quickly and retain the decision criterion. | `compare-contrast` | `ComparisonScreen`, `BeforeAfterScreen`, `TwoColumnScreen`, `VennDiagramScreen` |
| Steps, workflow, timeline, progress | Track position in an ordered process. | `process-flow` | `ProgressScreen`, `AgendaScreen`, `TimelineScreen`, `NumberedListScreen` |
| Summary, review, ending, next preview | Consolidate memory and connect to the next action. | `recap-synthesis` | `SummaryScreen`, `EndScreen`, `SectionBreakScreen`, `TitleScreen` |

## Preset Specs

Preset names are listed in `config/video.json` under `visualStylePresets.supportedPresets`. The policy metadata below is the source of truth for when to use each preset; the config intentionally keeps only the runtime-safe allowlist and default fallback.

| Preset | Intent | Immediate visual distinction | Scope |
|---|---|---|---|
| `concept-calm` | Low-noise concept intake. | Warm light background, high whitespace, gentle sequential motion. | Default policy fallback and opt-in for concept scenes. |
| `code-focus` | Reading accuracy and line-level attention. | Code surface priority, reduced decorative backdrop, restrained accent use. | Opt-in for code-centered Remotion scenes. |
| `demo-native` | Native tool recognition with minimal lecture framing. | Browser/app chrome stays dominant, annotations stay thin, theme tint is low. | Opt-in for Playwright, screenshot, browser mock, and image scenes. |
| `compare-contrast` | Fast contrast and decision criteria. | Two-sided color semantics, strong divider/axis, mirrored rhythm. | Opt-in for paired or competing information. |
| `process-flow` | Current position in a sequence. | Path or connector emphasis, active-step contrast, flow motion. | Opt-in for ordered flows. |
| `recap-synthesis` | Memory consolidation and next action. | Stronger hierarchy, compact grouped facts, slower emphasis. | Opt-in for recap and closing scenes. |

Each preset must differ from another preset by at least two dimensions among color semantics, typography density, texture/backdrop, elevation, layout rhythm, and motion. The current implementation records this contract and validates preset names; it does not yet switch the runtime `theme` per scene. Scope, typical component, and visual-difference descriptions are guidance only at this stage and are not enforced by the validator.

## Schema Policy

Use a scene-level field:

```json
{
  "visual": {
    "type": "remotion",
    "component": "ComparisonScreen",
    "stylePreset": "compare-contrast",
    "props": {}
  }
}
```

Policy:

- `visual.stylePreset` is optional for `remotion`, `playwright`, and `screenshot` visuals.
- Missing value falls back to the `visualStylePresets.defaultPreset` policy, currently `concept-calm`.
- Unknown values are validation errors in `ValidateLectureUseCase`.
- `stylePreset` is not a replacement for choosing the correct component. A weak component choice with a good preset still fails #122 quality criteria.
- Do not add `stylePreset` inside `visual.props`; it classifies the scene, not a single component prop.

## Migration Strategy

| Scope | Decision | Reason |
|---|---|---|
| Existing 25 lectures | No immediate migration. | Adding missing fields would not change current pixels until components consume the preset, and it would create noisy churn. |
| New or regenerated lectures | Opt in scene by scene. | The converter can start recording context intent without breaking render output. |
| #126 vertical slice (`lecture-03-04`) | Treat box-model diagram scenes as `concept-calm`; code scenes as `code-focus`; DevTools/browser scenes as `demo-native`; final summary as `recap-synthesis`. | This issue defines the classification policy. Pixel-level verification belongs to the first follow-up that makes components consume `stylePreset`. |
| Full-course adoption | Separate follow-up issue after #123. | The converter's information density policy should first decide which information units remain on screen. |

Expected breakage count for existing JSON: 0. The new field is optional, and current render code ignores it safely.

## Quality Checks

This PR does not claim pixel-level vertical slice validation because components do not yet consume `stylePreset`. For any future preset implementation that changes pixels, validate with the following checks:

1. Render the same information structure in the baseline and target preset.
2. Confirm all durable information units remain visible.
3. Confirm the primary visual hierarchy is unchanged or stronger.
4. Confirm text contrast and code readability do not regress.
5. Confirm before/after stills are listed in the issue or PR alongside the reference target.

For #126 vertical slice follow-up, sample checks should include:

| Scene group | Preset expectation | Check |
|---|---|---|
| Box-model layers | `concept-calm` | Nested content/padding/border/margin relation remains reconstructable from still only. |
| Code walkthrough scenes | `code-focus` | Highlighted code line stays more prominent than decorative elements. |
| DevTools/browser explanation | `demo-native` | Browser or DevTools context remains recognizable without lecture tint overpowering it. |
| Final recap | `recap-synthesis` | Summary groups facts compactly without becoming a single-line slogan. |

## Handoff to #123

JSON conversion should choose `stylePreset` after it chooses the information structure and component:

1. Decide the durable information units that must stay on screen.
2. Choose the component or domain visual pattern that can preserve those units.
3. Assign `visual.stylePreset` from the scene context table.
4. If no preset fits, keep the field absent and record the gap instead of inventing a one-off value.

#123 should use this document as the preset vocabulary when strengthening JSON conversion rules.
