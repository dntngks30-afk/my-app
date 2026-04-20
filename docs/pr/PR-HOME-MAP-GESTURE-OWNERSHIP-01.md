# PR-HOME-MAP-GESTURE-OWNERSHIP-01 — Home reset map pan lightening and refresh-conflict lock

## Parent context and purpose

This document locks a focused PR for the current `/app/home` reset-map interaction failure where the map feels too heavy to move, pan attempts frequently collide with browser/app pull-to-refresh, and starting a drag on top of a session node often opens the panel instead of moving the map.

The purpose of this PR is **not** to redesign the Home map, replace the donor presentation, or change session semantics.

The purpose is to keep the current donor-faithful map while making the map itself the clear owner of vertical gesture input and restoring a light, immediate drag response.

---

## Problem summary

The current user-visible failures are:

1. the map feels heavy and laggy while dragging,
2. map movement does not immediately track the user’s finger,
3. pull-down attempts can trigger page/browser refresh instead of moving the map,
4. dragging from a node or label often competes with panel-open behavior,
5. wheel/trackpad style vertical input is not clearly owned by the map surface.

This is not just a tuning issue. It is a gesture-ownership issue.

---

## CURRENT_IMPLEMENTED

Grounded current behavior from the repository:

1. `/app/home` currently promotes the donor map through `HomePageClient -> ResetMapV2 -> mapRenderer={DonorResetMap}`.
2. `ResetMapV2` renders the donor map inside a bounded card and keeps existing production `SessionPanelV2` behavior.
3. `src/features/map_ui_import/home_map_20260315/components/reset-map.tsx` uses a custom vertical pan model on an `overflow-hidden` surface rather than native scrolling.
4. The donor map root currently wires `onMouseDown/onMouseMove/onMouseUp` and `onTouchStart/onTouchMove/onTouchEnd` directly on the container.
5. The pan state is written into `panY`, but the main canvas is rendered with `springY = useSpring(panY, { stiffness: 80, damping: 28 })`, so live drag is visually mediated by a spring rather than following the finger directly.
6. The donor map root does not currently establish explicit gesture ownership using `touch-action` and `overscroll-behavior`.
7. `SessionNode` currently opens the panel on `onPointerDown` in normal mode, so a drag that begins on a node can trigger tap/open before pan intent is resolved.
8. Wheel/trackpad vertical input is not explicitly handled by the donor map surface.

Therefore the current bug is not one bad sensitivity number. The real issue is that the donor map has **custom pan without a hardened gesture-ownership contract**.

---

## Root cause truth map

The current failure chain is:

1. the map uses a custom pan surface instead of native scroll,
2. live drag updates go through a spring before the main canvas visibly moves,
3. the map surface does not explicitly contain touch/overscroll ownership,
4. panel-open behavior can fire on pointer-down before drag intent is established,
5. browser/app refresh or page-level vertical gesture handling can therefore compete with map movement,
6. the user experiences the map as heavy, unreliable, and refresh-prone.

The missing layer is a **gesture ownership and tap-vs-pan resolution boundary**.

---

## LOCKED_DIRECTION

The fix must follow these laws:

1. Keep the donor Home map visual identity.
2. Keep current session truth, node display truth, and panel-opening destination.
3. Do not redesign the road, layout system, or session semantics.
4. Make the map surface the clear owner of vertical gesture input while the user is interacting with it.
5. Drag intent must be allowed to defeat tap intent.
6. Live drag must feel immediate; easing may exist after release, but not between finger and map during active pan.

---

## Scope

### In scope

- donor map gesture ownership,
- live pan responsiveness,
- pull-to-refresh conflict prevention inside the map surface,
- tap-vs-drag resolution for session nodes,
- wheel/trackpad handling for the map,
- preserving current `ResetMapV2 -> SessionPanelV2` behavior once a real tap is confirmed.

### Primary file scope

- `src/features/map_ui_import/home_map_20260315/components/reset-map.tsx`

### Optional helper extraction scope

If clarity improves, one additive helper may be introduced, for example:

- `src/features/map_ui_import/home_map_20260315/components/map-pan-gesture.ts`

### Minimal secondary scope

Only if strictly necessary:

- `src/app/globals.css`

---

## Explicit non-goals

This PR must **not**:

- change session truth,
- change node display truth hierarchy,
- change Home bootstrap/auth/readiness/payment,
- change ResetMap flow semantics,
- redesign the donor map,
- change the curved road geometry,
- change viewport-safe node layout rules,
- change `SessionPanelV2` meaning,
- change session labels/copy taxonomy.

---

## Core decision

Introduce an explicit **gesture ownership boundary** for the donor Home map.

The road, node layout, and panel behavior remain as they are.

But the map surface must now own:

- vertical pan input,
- tap-vs-drag resolution,
- browser-refresh conflict prevention,
- wheel/trackpad vertical movement while the pointer is over the map.

---

## Required implementation shape

## 1) Separate active drag from settle animation

The main canvas must not visually lag behind the finger during active drag.

### Locked rule

- During active drag, the main canvas position must follow raw pan state directly.
- Any spring/inertia/easing may apply only after release or during passive settling.
- Decorative/parallax layers may keep softer motion if desired, but the **main map canvas** must not be spring-mediated during active drag.

### Why

This is the direct fix for the current “heavy scroll” feeling caused by live motion being rendered through `springY`.

---

## 2) Replace mixed mouse/touch drag ownership with a unified pointer-first gesture model

The current split mouse/touch handling should be consolidated into a pointer-first model.

### Locked rule

Use a clear map-surface gesture state with at least:

- `idle`
- `pressing`
- `panning`

Track at minimum:

- active pointer id,
- press start position,
- latest position,
- accumulated travel distance,
- velocity,
- whether tap is still allowed.

### Required behavior

- `pointerdown` starts a candidate gesture,
- small movement keeps the interaction in a pending/tap-candidate state,
- movement beyond threshold upgrades the interaction to pan,
- once pan is active, tap/open must be suppressed,
- `pointerup` only opens a session when the gesture never meaningfully became a pan.

### Why

This is the correct boundary between “I want to open the node” and “I want to move the map.”

---

## 3) Node activation must move from pointer-down to tap-confirm

The current `SessionNode` behavior is too eager.

### Locked rule

Normal-mode session open must no longer fire on `pointerdown`.

Instead:

- pointer-down marks a candidate tap,
- drag threshold crossing cancels tap eligibility,
- session open fires only on confirmed tap/click release semantics.

### Why

This is required so users can start a drag from directly on top of a node or label without immediately opening the panel.

---

## 4) Establish explicit touch/overscroll ownership on the donor map root

The donor map root must explicitly contain vertical gesture ownership while interacting.

### Locked rule

The map root should establish map-owned gesture behavior using a combination such as:

- `touch-action: none`,
- `overscroll-behavior-y: contain` or equivalent,
- active drag `preventDefault` where required by runtime behavior.

### Important boundary

This must be scoped to the map surface itself.
It must not become a global body scroll lock.

### Why

This is the structural fix for pull-to-refresh collision and parent/page gesture leakage.

---

## 5) Add wheel/trackpad vertical ownership for desktop and laptop interaction

The map currently lacks explicit wheel handling.

### Locked rule

When wheel/trackpad input occurs over the donor map surface:

- the map should consume vertical input for map movement,
- movement should be clamped to the existing map pan bounds,
- propagation to page-level scroll should be prevented while the map is actively handling the input,
- scaling/multiplier should stay conservative and not create jumpy movement.

### Why

This ensures the map behaves like an intentional pannable surface on desktop as well, not only on touch devices.

---

## 6) Use pointer capture so pan ownership remains stable during drag

### Locked rule

When pan interaction starts, the map surface should capture the active pointer and release it on end/cancel.

### Why

This avoids losing drag ownership when the finger/mouse briefly leaves the original surface bounds.

---

## 7) Preserve mapEdit developer behavior as a separate priority path

The dev-only map editing mode currently owns pointer interactions for manual node/label adjustment.

### Locked rule

- In normal production interaction, map pan ownership rules apply.
- In `mapEdit` mode, manual node/label drag tools remain the priority owner.

The new gesture boundary must not break dev editing workflows.

---

## Suggested implementation structure

A safe implementation shape is:

1. keep donor map visual/layout logic unchanged,
2. extract or locally define a small pan gesture controller,
3. make the main canvas render raw drag state during active pan,
4. keep optional settle animation after release,
5. move session open to tap-confirm semantics,
6. add root-level touch/overscroll/wheel ownership rules.

This keeps the PR local and presentation/input-scoped.

---

## Acceptance criteria

The PR is complete only when all of the following are true:

1. In `/app/home`, the map immediately follows the user during drag.
2. The current heavy/laggy drag feeling is gone.
3. Pulling down inside the map no longer triggers browser/app refresh instead of map movement.
4. Starting a drag from on top of a node or label no longer opens the panel prematurely.
5. A real short tap on a node still opens the existing panel correctly.
6. Wheel/trackpad vertical input moves the map while interacting over the map.
7. Existing donor visuals, glow treatment, and session statuses remain intact.
8. No session truth, panel semantics, or reset-map flow semantics change.
9. The behavior still works for `total = 8, 12, 16, 20`.
10. The PR remains local to the donor-map interaction layer.

---

## Regression checklist

Manual verification must include at least:

1. `/app/home?mapV2=1&ts=8&cs=0`
2. `/app/home?mapV2=1&ts=12&cs=3`
3. `/app/home?mapV2=1&ts=16&cs=7`
4. `/app/home?mapV2=1&ts=20&cs=12`
5. drag beginning on empty map background,
6. drag beginning on a session node,
7. drag beginning on a label block,
8. short-tap opening the session panel,
9. pull-down attempts near the top of the map on mobile,
10. wheel/trackpad movement on desktop,
11. iOS Safari or installed iOS PWA,
12. Android Chrome or installed Android PWA.

---

## Why this is safe relative to SSOT

This PR is input-boundary and presentation-layer only.

It does not alter:

- analysis truth,
- session generation,
- readiness decisions,
- payment/auth flow,
- public-result flow,
- session-panel meaning,
- node display truth sourcing.

It only hardens how the existing Home donor map receives and resolves user input.

---

## Residual risks

1. Wheel sensitivity may need one small follow-up tuning pass after real-device testing.
2. Some browsers handle `touch-action` and pull-to-refresh slightly differently, so real-device verification remains important.
3. Pointer-first unification must be checked carefully against existing dev `mapEdit` interactions.

These are acceptable residual risks. They do not justify keeping the current heavy-drag and refresh-conflict failure mode.

---

## Final product stance

The correct fix is not to tweak one drag constant.

The correct fix is to make the donor Home map the explicit owner of vertical gesture input, let live drag follow the user directly, and allow node panels to open only after tap intent is confirmed.
