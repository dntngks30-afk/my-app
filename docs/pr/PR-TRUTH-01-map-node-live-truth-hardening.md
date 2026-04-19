# PR-TRUTH-01 — Map node live truth hardening

## Parent SSOT

- Parent: `docs/pr/PR-TRUTH-PARENT-SESSION-DISPLAY-AND-GENERATION-ALIGNMENT.md`
- Related earlier parent: `docs/pr/PR-MAP-NODE-DISPLAY-SSOT-01.md`

This PR is the first child PR in the session display/generation alignment truth map.

---

## Goal

Stop Home Reset Map near-session nodes from falling back to legacy static semantic copy when runtime session truth already exists or can be cheaply resolved.

This PR owns **map node truth source hierarchy** only.

It does **not** change session generation semantics, onboarding semantics, or panel rationale generation.

---

## Locked problem statement

Current map node display can still degrade to:

- `legacy_map_data`
- `arc_template`

for nodes that are visibly important to the user, including current / next / recently relevant sessions.

Because Session Panel already reads runtime plan/summary/bootstrap truth, this creates a visible mismatch where:

- panel feels type-aware,
- but map node text still feels like old generic copy.

The failure is not wording quality.
It is **source hierarchy failure**.

---

## Scope

### In scope

- tighten map node source resolution for visible/current/next sessions
- reduce use of `legacy_map_data` as semantic owner
- ensure bootstrap/home hydration fills enough display truth for near nodes
- ensure donor map / JourneyMap consume resolved `nodeDisplayBySession` for runtime text
- keep far-future placeholder behavior lightweight and explicit

### Out of scope

- no change to scoring / deep result semantics
- no change to session plan generation
- no change to onboarding meaning
- no panel wording redesign
- no new map chips / badges / technical indicators
- no visual redesign of geometry / path / terrain

---

## Locked truth

### Truth 1 — `map-data.ts` is not canonical semantic truth for near nodes

`map-data.ts` may remain the owner of:

- geometry
- coordinates
- week grouping
- fallback visual seed

It must not remain the canonical semantic owner of current / next / recently visible runtime nodes.

### Truth 2 — `legacy_map_data` is recovery-only

`legacy_map_data` may be used only when runtime display truth is unavailable and there is no better cheap runtime derivation.

It must not be the default owner for:

- current session
- next session
- bootstrap-resolvable near sessions
- hydrated completed sessions

### Truth 3 — `arc_template` is far-future placeholder only

`arc_template` is allowed only for nodes that genuinely have no runtime-confirmed or preview truth.

It must not override:

- active plan meta
- summary meta
- hydrated history meta
- bootstrap meta
- usable next preview meta

### Truth 4 — visible/current/next nodes should prefer runtime display contract

For the visible operational surface, the canonical priority remains:

1. active full plan
2. summary
3. hydrated history
4. bootstrap
5. usable next preview
6. legacy fallback
7. arc placeholder

But this PR further locks that **near operational nodes must not casually drop to 6/7**.

### Truth 5 — map and panel may differ in depth, not in truth family

Map can remain compact.
Panel can remain richer.
But both must read from the same display field family / resolver path when runtime truth exists.

---

## Required behavior changes

### A. Tighten `legacyFallback` reach

Current resolver behavior allows `legacyFallback()` too easily.

This PR must narrow that path so that:

- current session prefers active/summary/bootstrap-driven display
- next session prefers bootstrap or usable preview-driven display
- recently completed sessions prefer hydrated/summary-driven display

### B. Strengthen bootstrap/home node hydration for near nodes

The bootstrap-driven `node_display_bundle` should be treated as the canonical compact display slice for home entry when available.

If current visible nodes can be cheaply hydrated from `session_plans.plan_json.meta`, that data should be preferred over static map copy.

### C. Keep far-future lightweight

Far-future unresolved nodes may still use `arc_template`, but only as provisional placeholder truth.

The PR must not try to generate fake final meaning for all future sessions.

### D. Donor map path must actually render resolved node text

If the imported donor map path is active, it must consume the same `nodeDisplayBySession` semantic output as `JourneyMapV2`.

A prop passed but ignored is considered a truth failure.

---

## Files expected to change

Primary expected files:

- `src/app/app/(tabs)/home/_components/reset-map-v2/session-node-display.ts`
- `src/app/app/(tabs)/home/_components/reset-map-v2/map-data.ts`
- `src/lib/session/home-node-display-bundle.ts`
- `src/app/api/app/bootstrap/route.ts`
- `src/app/app/(tabs)/home/_components/reset-map-v2/ResetMapV2.tsx`
- donor map importer/render path if it does not consume runtime node display truth

Possible read-only / inspection files:

- `src/app/app/(tabs)/home/_components/HomePageClient.tsx`
- `src/lib/session/session-node-display-hydration-item.ts`
- `src/lib/session/session-display-contract.ts`
- `src/lib/session/session-display-copy.ts`

---

## Implementation rules

### Rule 1 — Behavior-preserving for generator semantics

Do not change:

- `buildSessionPlanJson` behavior
- first-session intent semantics
- onboarding experience semantics
- scoring / pain-mode meaning

### Rule 2 — Display-source hardening only

This PR may change:

- what display source is chosen for near nodes
- what bootstrap/hydration data is passed to the resolver
- whether donor renderer actually consumes the resolved node display payload

### Rule 3 — No new user-facing technical state labels

Do not show `confirmed / preview / placeholder` on the UI.
This PR is internal truth hardening, not a new map annotation feature.

### Rule 4 — No broad fallback deletion without replacement

Do not simply remove `legacyFallback` or `arc_template`.
Narrow and demote them; do not create empty-node regressions.

---

## Acceptance criteria

1. Current session node on the map no longer shows stale static semantic copy when active/summary/bootstrap truth exists.
2. Next session node no longer defaults to old generic map copy when usable preview/bootstrap truth exists.
3. Recently completed sessions prefer hydrated/summary runtime display over static map-data semantics.
4. Far-future unresolved nodes may remain approximate through placeholder arc logic.
5. Donor map path and non-donor path render the same semantic node truth family.
6. No changes to generation meaning, onboarding meaning, or panel rationale semantics are introduced in this PR.

---

## Regression risks

### Risk 1 — Empty labels if runtime display bundle is thin

If fallback demotion is too aggressive, some nodes may render with missing text.

Mitigation:

- narrow fallback conditions carefully
- preserve legacy fallback as final safety net only

### Risk 2 — Donor renderer ignores runtime payload

If donor map does not consume `nodeDisplayBySession`, visual mismatch will remain despite resolver hardening.

Mitigation:

- inspect donor render path explicitly
- patch the semantic text source there if needed without redesigning visuals

### Risk 3 — Bootstrap payload under-hydration

If bootstrap does not include enough node display truth, near nodes may still degrade.

Mitigation:

- strengthen home node display bundle for visible sessions
- prefer already-materialized `session_plans.plan_json.meta` when present

---

## Done means

This PR is done when the user can look at the Home map and the Session Panel for near sessions and no longer feel that one is still using the old pre-runtime copy system while the other uses the new runtime meaning.
