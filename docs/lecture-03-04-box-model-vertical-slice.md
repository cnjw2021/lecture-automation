# Lecture 03-04 box model vertical slice

Related: #122, #126, #125

Date: 2026-04-27

## Scope

Vertical slice target: `data/lecture-03-04.json` (ボックスモデル — CSSの核心概念).

This pilot focuses on the largest gap identified in `docs/remotion-infographic-baseline-audit.md`: box model concepts were represented as text lists even though the underlying learning object is spatial and layered.

Reference topic: MDN box model material.

Reference quality target:

- nested content / padding / border / margin layers visible at once
- DevTools-like color semantics
- `width` calculation visible without narration
- padding vs margin distinction visible from position and fill, not only text

## Rendered evidence

Rendered still output directory: `/tmp/review/pr-130-stills`.

| Scene | Before still | After still | Reference comparison target |
|---:|---|---|---|
| 5 | `/tmp/review/pr-130-stills/before-scene-5.png` | `/tmp/review/pr-130-stills/after-scene-5.png` | MDN box model nested layers: content + padding |
| 6 | `/tmp/review/pr-130-stills/before-scene-6.png` | `/tmp/review/pr-130-stills/after-scene-6.png` | MDN box model nested layers: border + margin |
| 15 | `/tmp/review/pr-130-stills/before-scene-15.png` | `/tmp/review/pr-130-stills/after-scene-15.png` | MDN box model summary diagram |
| 20 | `/tmp/review/pr-130-stills/before-scene-20.png` | `/tmp/review/pr-130-stills/after-scene-20.png` | DevTools box model color map |
| 25 | `/tmp/review/pr-130-stills/before-scene-25.png` | `/tmp/review/pr-130-stills/after-scene-25.png` | content-box width arithmetic |
| 28 | `/tmp/review/pr-130-stills/before-scene-28.png` | `/tmp/review/pr-130-stills/after-scene-28.png` | border-box sizing contrast |
| 36 | `/tmp/review/pr-130-stills/before-scene-36.png` | `/tmp/review/pr-130-stills/after-scene-36.png` | card layout mapped to box model layers |

Regression stills for unrelated lectures:

| Lecture | Scene | Still |
|---|---:|---|
| `lecture-01-01.json` | 3 | `/tmp/review/pr-130-stills/lecture-01-01-scene-3.png` |
| `lecture-03-05.json` | 7 | `/tmp/review/pr-130-stills/lecture-03-05-scene-7.png` |

## Explanation scene coverage

Title, code-centered, and end scenes are excluded from this table because #126 asks for explanation-scene comparison. Excluded scenes: 1, 10-14, 27, 29, 31-33, 35, 37, 40.

`CodeWalkthroughScreen` scenes 12, 14, and 33 do explain code, but their primary gap is code/result mapping rather than box-model layer visualization. Treat them as follow-up input for #127 instead of expanding this PR's pilot scope.

| Scene | Status | Component after pilot | Decision / follow-up |
|---:|---|---|---|
| 2 | unchanged | `QnAScreen` | Opening problem statement. No box-model structure yet; current question-answer format is acceptable. |
| 3 | unchanged | `KeyPointScreen` | Single concept emphasis. Could benefit from richer intro art later, but not a #127 blocker. |
| 4 | unchanged | `DefinitionScreen` | Term definition before layer details. Kept to avoid overloading the first definition scene. |
| 5 | changed | `BoxModelDiagramScreen` | Content and padding need nested spatial relation. |
| 6 | changed | `BoxModelDiagramScreen` | Border and margin need boundary/outside relation. |
| 7 | unchanged | `TwoColumnScreen` | Cardboard-box analogy is readable as two columns. Optional future #128 tone/style refinement. |
| 8 | unchanged | `CalloutScreen` | One decisive contrast: padding gets background, margin is transparent. Current callout is adequate. |
| 9 | unchanged | `KeyPointScreen` | Practice transition screen. No additional structural information required. |
| 15 | changed | `BoxModelDiagramScreen` | Recap should preserve 4-layer position relation. |
| 16 | unchanged | `TwoColumnScreen` | Padding vs margin comparison remains appropriate. Future #127 may add paired layer-state variant. |
| 17 | unchanged | `CalloutScreen` | Memory rule scene. No structural gap after scenes 15-16. |
| 18 | unchanged | `KeyPointScreen` | DevTools section transition. Current single-message emphasis is enough. |
| 19 | unchanged | `BrowserMockScreen` | Browser UI concept. Kept because actual DevTools operation is outside this pilot. |
| 20 | changed | `BoxModelDiagramScreen` | DevTools color map is inherently visual. |
| 21 | unchanged | `CalloutScreen` | Troubleshooting tip. Depends on scene 20 visual context. |
| 22 | unchanged | `CalloutScreen` | DevTools numeric edit tip. Future Playwright/DevTools capture may be #127/#128 follow-up. |
| 23 | unchanged | `IconListScreen` | Three use cases for DevTools. Current icon list is acceptable. |
| 24 | unchanged | `QnAScreen` | Sizing quiz. It intentionally sets up scene 25. |
| 25 | changed | `BoxModelDiagramScreen` | `300 + 40 + 4 = 344px` needs layer-linked calculation. |
| 26 | unchanged | `CalloutScreen` | Warning about layout breakage. Kept as transition to `box-sizing`. |
| 28 | changed | `BoxModelDiagramScreen` | `border-box` effect needs the same diagram with changed sizing semantics. |
| 30 | unchanged | `KeyPointScreen` | Practice transition into card layout. |
| 34 | unchanged | `CalloutScreen` | `border-radius` is a focused supplementary property. Not part of the 4-layer gap. |
| 36 | changed | `BoxModelDiagramScreen` | Card layout should connect padding/border/margin/box-sizing to one concrete object. |
| 38 | unchanged | `CalloutScreen` | Next lecture bridge to Flexbox. No box-model visual gap. |
| 39 | unchanged | `SummaryScreen` | Whole-lecture summary. Scene 15 already carries the layer recap; this keeps the final summary concise. |

## #122 criteria check

| Criterion | Pilot result |
|---|---|
| Audio dependency | Improved for core box model scenes. A still now shows the 4 layers, inside/outside relation, and size formula. |
| Simultaneous information units | Box-model scenes show at least 3 durable units: layered diagram, right-side callouts, and optional formula/result. |
| Visual hierarchy | The layered diagram is primary; callouts and formula support it. Highlighted layers guide focus per scene. |
| Reference comparison | Seven changed scenes now have before/after stills listed above and can be compared against MDN/DevTools-style box model diagrams. |
| Narration-screen fit | The screen now complements narration with spatial structure and arithmetic instead of repeating list text. |

## Implementation note

`BoxModelDiagramScreen` is a #126 pilot component, not yet a generalized domain library. It is split by responsibility under `packages/remotion/src/components/box-model/`:

- `types.ts`: props and layer types
- `model.ts`: defaults, layer ordering, props normalization
- `BoxModelLayerDiagram.tsx`: nested spatial diagram
- `BoxModelFormula.tsx`: width formula
- `BoxModelCallouts.tsx`: right-side explanatory cards
- `BoxModelHeader.tsx`: shared header block

Boundary for #127: this PR proves the box-model pattern is useful in one vertical slice. #127 should still decide whether this remains CSS-specific or becomes a generic layered-region diagram pattern.

## 25-lecture impact

| Area | Assessment |
|---|---|
| Existing JSON compatibility | Preserved. The new component is additive and existing component schemas remain unchanged. |
| Props/schema breakage | Expected broken lecture count: 0. `BoxModelDiagramScreen` is only used by `lecture-03-04.json`; other lectures do not opt into it. |
| Render cost | No 25-lecture rerender is required for this PR. If the pattern is rolled out to all 25 lectures later, render cost should be planned as a separate batch because the current corpus has about 900 visual scenes. TTS/audio generation does not need to be redone for this additive visual-only change. |
| Review cost | Only the seven changed `lecture-03-04` scenes need visual review now. Full-course adoption should be scoped after #127 decides component ownership. |
| Tone change | Limited to `lecture-03-04` box-model scenes. Other lectures keep their current visual rhythm, so cross-lecture tone drift is not introduced by this PR. |
| Follow-up | #127 should absorb or generalize the component. #128 can later decide whether CSS concept diagrams need a dedicated context style. |
| Lint tracking | `lecture-03-04` narration still has 21 known `A-tts-landmines` findings. Tracked separately in #131 before final video rendering. |

## Verification

- `npm run build -w packages/automation`
- `npx tsx packages/automation/src/presentation/cli/validate-lecture-schema.ts lecture-03-04.json --strict`
- `npx remotion compositions src/PreviewRoot.tsx`
- Rendered changed-scene before/after stills for scenes 5, 6, 15, 20, 25, 28, 36.
- Rendered unrelated lecture stills for `lecture-01-01.json` scene 3 and `lecture-03-05.json` scene 7.
- `make lint LECTURE=lecture-03-04.json STRICT=1` was run and still reports 21 `A-tts-landmines` errors in narration text (`てみ`, standalone `p`, `タグ`). This PR does not edit narration; #131 tracks the required fix before final video rendering.
