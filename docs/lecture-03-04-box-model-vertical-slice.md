# Lecture 03-04 box model vertical slice

Related: #122, #126, #125

Date: 2026-04-27

## Scope

Vertical slice target: `data/lecture-03-04.json` (ボックスモデル — CSSの核心概念).

This pilot focuses on the largest gap identified in `docs/remotion-infographic-baseline-audit.md`: box model concepts were represented as text lists even though the underlying learning object is spatial and layered.

## Reference baseline

Reference topic: MDN box model material.

Reference quality target:

- nested content / padding / border / margin layers visible at once
- DevTools-like color semantics
- `width` calculation visible without narration
- padding vs margin distinction visible from position and fill, not only text

## Changed scenes

| Scene | Before | After | Reason |
|---|---|---|---|
| 5 | `BulletDetailScreen` | `BoxModelDiagramScreen` | Content and padding need nested spatial relation, not a two-item list. |
| 6 | `BulletDetailScreen` | `BoxModelDiagramScreen` | Border and margin need visible boundary/outside relation. |
| 15 | `SummaryScreen` | `BoxModelDiagramScreen` | The recap should preserve the 4-layer position relation. |
| 20 | `BulletDetailScreen` | `BoxModelDiagramScreen` | DevTools color map is inherently visual. |
| 25 | `ComparisonScreen` | `BoxModelDiagramScreen` | `300 + 40 + 4 = 344px` needs layer-linked calculation. |
| 28 | `CalloutScreen` | `BoxModelDiagramScreen` | `border-box` effect needs the same diagram with changed sizing semantics. |
| 36 | `BulletDetailScreen` | `BoxModelDiagramScreen` | Card layout should connect padding/border/margin/box-sizing to one concrete object. |

## #122 criteria check

| Criterion | Pilot result |
|---|---|
| Audio dependency | Improved for core box model scenes. A still now shows the 4 layers, inside/outside relation, and size formula. |
| Simultaneous information units | Box-model scenes show at least 3 durable units: layered diagram, right-side callouts, and optional formula/result. |
| Visual hierarchy | The layered diagram is primary; callouts and formula support it. Highlighted layers guide focus per scene. |
| Reference comparison | Scene 25 still was rendered to `/tmp/box-model-scene-25.png` and is comparable to MDN-style box model diagrams. |
| Narration-screen fit | The screen now complements narration with spatial structure and arithmetic instead of repeating list text. |

## Implementation note

`BoxModelDiagramScreen` is a #126 pilot component, not yet a generalized domain library. It is split by responsibility under `packages/remotion/src/components/box-model/`:

- `types.ts`: props and layer types
- `model.ts`: defaults, layer ordering, props normalization
- `BoxModelLayerDiagram.tsx`: nested spatial diagram
- `BoxModelFormula.tsx`: width formula
- `BoxModelCallouts.tsx`: right-side explanatory cards
- `BoxModelHeader.tsx`: shared header block

This keeps the screen entry component focused on composition rather than owning all rendering details in one file.

## 25-lecture impact

- Existing JSON compatibility is preserved. The new component is additive.
- `REMOTION_PROPS_SCHEMAS` now knows `BoxModelDiagramScreen`; existing components remain unchanged.
- Only `lecture-03-04.json` was migrated in this pilot.
- Other lectures are unaffected unless their JSON opts into the new component.
- Reusable follow-up for #127: decide whether `BoxModelDiagramScreen` remains CSS-specific or becomes a generic layered-region diagram pattern.
