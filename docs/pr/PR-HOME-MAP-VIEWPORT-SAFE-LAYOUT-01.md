# PR-HOME-MAP-VIEWPORT-SAFE-LAYOUT-01 — Home reset map viewport-safe node layout

## Parent SSOT and purpose

This document locks the design for fixing the current `/app/home` reset-map issue where some session buttons and labels drift outside the visible map area and become partially unreadable or untappable.

The purpose of this PR is **not** to redesign the Home map. The purpose is to preserve the donor-faithful curved-road map while making the final node/button/label placement **viewport-safe**.

This is a design/implementation-lock document for one focused PR.

---

## Problem summary

On the current Home reset map, some session nodes are rendered outside the visible horizontal bounds of the map card. In practice this creates four user-facing failures:

1. some session buttons are partially or fully outside the visible viewport,
2. some labels or subtitles are clipped,
3. some nodes become hard or impossible to tap,
4. some attempted fallback layouts degrade text into an effectively vertical reading experience, which destroys readability.

The issue is structural, not copy-specific.

---

## CURRENT_IMPLEMENTED

Grounded current behavior from the repository:

1. `/app/home` currently promotes the donor map in production flow through `HomePageClient -> ResetMapV2 -> mapRenderer={DonorResetMap}`.
2. `ResetMapV2` gives the donor renderer a bounded card surface (`height: 80vh`, `maxHeight: 720`) and an inner map area with `minHeight: 480`.
3. `src/features/map_ui_import/home_map_20260315/components/reset-map.tsx` uses a fixed `CANVAS_WIDTH = 600` and `VIEWPORT_HEIGHT = 480`.
4. Session anchors are computed from the road path through `computeAnchorsFromPath(...)`, but final left/right placement is based on fixed offsets (`RIGHT_PANEL_OFFSET`, `LEFT_PANEL_OFFSET`) rather than measured viewport-safe bounds.
5. Session labels are rendered outside the node using a left/right side container with `whitespace-nowrap`, so the text footprint is allowed to exceed the visible card even when the node anchor itself looks acceptable.
6. Special-case manual shifts already exist for early sessions (`i === 0`, `i === 1`), which indicates the current placement model already needs manual rescue logic.

Therefore the current bug is not one broken coordinate. The real bug is that the donor map has **path-based anchor generation without a viewport-safe final layout pass**.

---

## LOCKED_DIRECTION

The fix must follow these product and engineering laws:

1. Keep the donor curved-road identity.
2. Keep the current session progression meaning and click behavior.
3. Do not change session semantics, session truth, node display truth hierarchy, or SessionPanel behavior.
4. Do not solve this by shrinking everything until it fits.
5. Do not hardcode per-session rescue coordinates as the main strategy.
6. The final rendered footprint that must stay visible is **node + label block**, not only the path anchor.
7. Long Korean text must be allowed to wrap instead of forcing off-screen overflow.
8. **Horizontal readability is mandatory.** Text must remain horizontally readable like the original donor intent; vertical text treatment is forbidden.
9. **Containment is more important than alternating left/right rhythm.** The alternating rule is optional and may be broken whenever necessary to keep node and text fully inside the map.

---

## NOT_YET_IMPLEMENTED

The current donor map does not yet have:

- a measured viewport-safe horizontal layout layer,
- overflow-aware side flipping,
- clamp logic based on the full rendered footprint,
- a horizontal-safe fallback layout for extremely narrow conditions,
- wrapped label treatment for long runtime copy,
- an explicit ban on vertical text degradation.

---

## Scope

This PR is limited to the donor Home map presentation/layout layer.

### In scope

- viewport-safe placement for all visible session nodes,
- safe placement for node label/subtitle blocks,
- text wrapping and width rules so labels are readable,
- maintaining tap accessibility for all nodes,
- preserving current production behavior for node tap -> `ResetMapV2` -> `SessionPanelV2` flow.

### Primary file scope

- `src/features/map_ui_import/home_map_20260315/components/reset-map.tsx`

### Optional helper extraction scope

One additive helper file may be introduced if it improves clarity, for example:

- `src/features/map_ui_import/home_map_20260315/components/session-node-layout.ts`

`HomePageClient.tsx` and `ResetMapV2.tsx` should remain unchanged unless a minimal wiring adjustment is strictly necessary.

---

## Explicit non-goals

This PR must **not**:

- change Home bootstrap/session/auth/readiness logic,
- change node display truth sourcing,
- change map copy taxonomy,
- redesign the map into a different visual system,
- remove the curved route,
- change vertical panning model,
- change session count semantics (8/12/16/20 support must remain),
- change SessionPanel copy or route-to-panel ownership,
- introduce a new semantic layer for completed/current/locked states,
- accept vertically stacked text as an allowed fallback.

---

## Root cause truth map

The current failure chain is:

1. the map uses a fixed wide canvas (`600`) inside a narrower visible card,
2. path anchors are sampled correctly for road geometry,
3. the final node center is shifted left/right with fixed offsets,
4. the label is then rendered *outside* the node again,
5. the label block uses `nowrap`,
6. no final pass checks whether the combined node + label footprint is still inside the measured visible card,
7. therefore some nodes remain visually or interactively outside the safe viewport,
8. and a naive fallback can make the text technically “fit” while becoming vertically unreadable.

This means the missing layer is a **final containment/layout pass**, not a new road path.

---

## Core decision

Introduce a **viewport-safe final layout layer** after path-anchor sampling.

### The road/path remains the geometry source of truth

The existing SVG path and `getPointAtLength(...)` sampling remain the source of truth for the road trajectory.

### But the final rendered node block becomes a separate containment concern

After the road anchor is sampled, the app must calculate a viewport-safe placement for:

- node center,
- label side,
- label width,
- label alignment,
- fallback layout mode.

The final placement must be computed against the **actual measured map container width**, not only the static canvas width.

---

## Layout contract

Before rendering a visible session node, the renderer should normalize a layout object like:

```ts
export type SessionNodeLayoutMode = 'side-inline' | 'stacked-below'

export type SessionNodePlacement = {
  nodeX: number
  nodeY: number
  labelSide: 'left' | 'right'
  layoutMode: SessionNodeLayoutMode
  labelMaxWidth: number
  labelAlign: 'left' | 'right' | 'center'
}
```

This object is purely presentational. It does not own session truth.

---

## Required layout algorithm

For each visible session node, the final layout must follow this order:

### Step 1 — measure the real visible width

Use the actual rendered container width from the donor map surface, not a hardcoded width.

Define a horizontal safe zone such as:

- `safeLeft = 16`
- `safeRight = containerWidth - 16`

### Step 2 — sample the road anchor from the SVG path

Continue using the existing path-based geometry system.

### Step 3 — choose a preferred side

Alternating left/right may remain only as a **soft preference**.
It is not a rule that may override containment.

### Step 4 — estimate the rendered footprint

Estimate the width occupied by:

- tap node,
- gap between node and label,
- label block max width.

The algorithm must reason about the **combined footprint**, not only node center.

### Step 5 — overflow check

Test whether the preferred placement would violate:

- left safe bound,
- right safe bound.

### Step 6 — flip if needed

If the preferred side overflows, try the opposite side first.

### Step 7 — clamp if still needed

If both sides are tight, clamp the node center and label start/end positions so the visible footprint stays inside the safe zone.

### Step 8 — horizontal stacked fallback for narrow cases

If side-inline placement still cannot keep the content readable, move the label into a stacked-below mode:

- node remains near the road,
- label becomes centered below the node,
- text stays **horizontal**, multi-line, and bounded in width,
- the fallback must never switch to per-character vertical stacking or vertical writing-mode treatment.

This fallback should be rare, but it must exist.

---

## Label rendering rules

The current `nowrap` behavior is structurally unsafe and must be replaced.

### Required text rules

- labels must allow wrapping,
- label width must be bounded,
- large label should allow up to 2 lines,
- subtitle should allow 1 line by default and may allow 2 lines if needed,
- the text block must remain fully visible,
- text truncation should be avoided for the primary label,
- text must remain horizontally readable,
- CSS or layout choices that produce vertical text are forbidden.

### Explicit forbidden outcomes

The implementation must not produce any of the following:

- one character per line vertical stacking caused by too-small width,
- `writing-mode: vertical-*`,
- `text-orientation` based vertical treatment,
- a fallback where the text technically fits but reads top-to-bottom character-by-character.

### Recommended practical defaults

These values may be tuned during implementation, but the idea is locked:

- label max width: roughly `96–140px` on mobile,
- label min readable width: roughly `72–88px`,
- node-to-label gap: roughly `8–12px`,
- node touch footprint: at least `40–44px`,
- safe horizontal inset: at least `16px`.

The key is not the exact number. The key is that width tuning must preserve **horizontal readability**.

---

## Special-case policy

The current session 1 / session 2 manual shifts are not a durable ownership model.

### Locked rule

- one-off session-specific rescue offsets may remain only if they are still required after the viewport-safe system exists,
- but they may not remain the primary strategy.

The correct primary strategy is:

- measured safe layout,
- overflow-aware side flip,
- clamp,
- horizontal stacked fallback.

---

## Visual invariants to preserve

The implementation must preserve these donor-map traits:

- the road remains centered as the visual spine,
- nodes may alternate left/right in the normal case, but not at the cost of clipping,
- current active node glow behavior remains,
- completed/current/locked status visuals remain,
- vertical drag/pan behavior remains,
- map still feels donor-faithful rather than converted back to the old SVG map,
- text remains horizontally readable like the donor reading flow.

---

## Implementation shape

### Preferred implementation shape

Keep the change small and local.

1. add measured container width state,
2. convert anchor computation into a two-phase model:
   - road anchor sampling,
   - viewport-safe placement resolution,
3. update `SessionNode` label rendering to support wrapped bounded horizontal text,
4. preserve current node tap behavior.

### Recommended internal split

If helpful, extract a pure helper layer:

- `computeAnchorsFromPath(...)` stays focused on road geometry,
- new helper resolves safe placement from `anchor + containerWidth + text rules`.

This separation is preferred because geometry and containment are different responsibilities.

---

## Acceptance criteria

The PR is complete only when all of the following are true:

1. In `/app/home`, every visible session button remains fully visible horizontally.
2. No visible session label is clipped by the left or right edge of the map card.
3. Nodes at both extremes remain tappable.
4. The donor curved-road presentation is still preserved.
5. The fix works for `total = 8, 12, 16, 20`.
6. The fix still works when runtime node labels/subtitles are longer than the legacy static map copy.
7. The active/current node glow and status visuals still behave the same.
8. No changes are made to session semantics or panel truth ownership.
9. No rendered session text becomes vertically oriented or effectively vertical in reading experience.
10. It is acceptable for the alternating left/right rhythm to break when required for containment.

---

## Regression checklist

Manual verification must include at least:

1. `/app/home?mapV2=1&ts=8&cs=0`
2. `/app/home?mapV2=1&ts=12&cs=3`
3. `/app/home?mapV2=1&ts=16&cs=7`
4. `/app/home?mapV2=1&ts=20&cs=12`
5. current session on a right-side anchor,
6. current session on a left-side anchor,
7. longest practical Korean map copy from runtime display source,
8. first/last visible node tap opening the existing panel correctly,
9. visual check that no label has degraded into vertical or near-vertical reading,
10. visual check that a containment-driven side break is allowed and does not count as a regression.

---

## Why this is safe relative to SSOT

This PR is presentation-layer containment only.

It does not alter:

- analysis truth,
- session generation,
- claimed result selection,
- readiness next action,
- reset-map flow ownership,
- SessionPanel semantics,
- map node display truth hierarchy.

It only ensures that the already-selected session display truth can be rendered inside the visible Home map safely and read horizontally.

---

## Residual risks

1. Very long runtime copy may still need tuning between side-inline and stacked-below thresholds.
2. The donor map’s visual balance may need micro-adjustment after safe clamping is introduced.
3. Touch vs drag interaction should be watched carefully after layout changes, especially near the side edges.

These are acceptable residual risks. They do not justify keeping the current off-screen failure mode or accepting vertical text degradation.

---

## Final product stance

The correct fix is not to redraw the road and not to hand-tune every bad node.

The correct fix is to keep the path as geometry truth and add a **viewport-safe final placement layer** so every session node is visible, readable, horizontally legible, and tappable inside the Home reset map.
