# PR-TRUTH-05 — Display SSOT closure

## Parent SSOT

- Parent: `docs/pr/PR-TRUTH-PARENT-SESSION-DISPLAY-AND-GENERATION-ALIGNMENT.md`
- Previous child: `docs/pr/PR-TRUTH-04-active-plan-profile-mismatch-guard.md`
- Related earlier parent: `docs/pr/PR-MAP-NODE-DISPLAY-SSOT-01.md`

This PR is the fifth child PR in the session display/generation alignment truth map.

---

## Goal

Close the remaining display source-of-truth drift so that map, panel, summary, bootstrap, and hydration consumers all read the **same canonical display field family** instead of partially reconstructing display meaning through parallel heuristics.

This PR owns **display contract closure** only.

It does not own generator semantics, onboarding semantics, or active-plan/profile regeneration policy.

---

## Locked problem statement

Earlier PRs improved:

- near-node source hierarchy,
- final-plan-aware rationale alignment,
- onboarding experience semantics,
- active-plan/profile mismatch reuse.

But display truth can still be partially reconstructed through multiple paths:

- `plan_json.meta`
- `plan-summary` read-time resolution
- bootstrap/home-node bundle hydration
- node-display-batch hydration
- display-copy helpers
- fallback derivation in map/panel consumers

As long as multiple readers can still invent display meaning from neighboring fields, the system remains vulnerable to drift, duplicated mapping logic, and future regression.

The failure is not one bad field.
It is **incomplete display truth closure**.

---

## Scope

### In scope

- define one canonical display field family and one canonical write/read boundary
- make summary/bootstrap/hydration flows pass through that same field family
- demote heuristic read-time display reconstruction to recovery-only behavior
- reduce duplicated display derivation logic where possible without broad redesign

### Out of scope

- no scoring changes
- no onboarding semantics changes
- no active-plan/profile mismatch policy changes
- no map geometry or visual redesign
- no SessionPanel redesign
- no public-result scoring/result redesign

---

## Locked truth

### Truth 1 — canonical display field family

The following field family is the canonical display truth family:

- `session_role_code`
- `session_role_label`
- `session_goal_code`
- `session_goal_label`
- `session_goal_hint`
- `session_focus_axes`
- `session_rationale`

Display consumers may use different subsets, but they must stop inventing parallel semantic ownership outside this family.

### Truth 2 — canonical write boundary

The canonical writer for display truth is the finalized session plan meta path.

Near-term read surfaces should prefer pass-through of already-written canonical display fields, not re-derivation from neighboring analysis fields unless recovery is required.

### Truth 3 — read-time derivation is recovery-only

Functions such as display-contract resolution and copy builders may still support recovery for:

- old plans,
- incomplete historical rows,
- backward-compatible payloads,
- placeholder/fallback situations.

But they must no longer be treated as the normal semantic author for fresh canonical paths.

### Truth 4 — summary/bootstrap/hydration must echo canonical fields

The following output paths must echo the canonical display field family whenever available:

- session plan summary
- bootstrap home node bundle
- node-display batch hydration
- active/summary compact data used by map and panel

### Truth 5 — map and panel differ in depth, not semantic ownership

Map may stay compact.
Panel may stay richer.
But both must read the same underlying canonical display field family.

---

## Required behavior changes

### A. Normalize pass-through paths

Where canonical display fields already exist in `plan_json.meta`, downstream APIs should pass them through directly instead of re-deriving them first.

### B. Narrow heuristic display reconstruction

Read-time helpers such as `resolveSessionDisplayContract(...)` should remain available, but canonical fresh-plan consumers should only need them for recovery or partial-payload completion, not as the primary semantic writer.

### C. Align hydration item shape with canonical family

Hydration/bundle item shapes should continue to match the canonical display field family directly.
Do not allow a second shadow schema to emerge.

### D. Keep backward compatibility

Older plans or partial payloads that lack canonical fields must still be displayable through recovery logic.
This PR must not break historical rendering.

---

## Files expected to change

Primary expected files:

- `src/lib/session/session-display-contract.ts`
- `src/lib/session/session-display-copy.ts`
- `src/lib/session/session-node-display-hydration-item.ts`
- `src/app/api/session/plan-summary/route.ts`
- `src/lib/session/home-node-display-bundle.ts`

Possible additive support files:

- `src/lib/session/client.ts`
- `src/app/api/app/bootstrap/route.ts`
- `src/app/api/session/node-display-batch/route.ts` or equivalent hydration route if needed

Possible read-only inspection files:

- `src/app/app/(tabs)/home/_components/reset-map-v2/session-node-display.ts`
- `src/app/app/(tabs)/home/_components/reset-map-v2/ResetMapV2.tsx`
- `src/app/app/(tabs)/home/_components/reset-map-v2/JourneyMapV2.tsx`
- `src/app/app/_components/SessionPanelV2.tsx`

---

## Implementation rules

### Rule 1 — canonical pass-through first

If canonical display fields already exist in plan meta, prefer direct pass-through over reconstruction.

### Rule 2 — recovery logic remains, but demoted

Do not delete recovery logic.
Demote it to legacy/partial payload handling rather than normal fresh-plan behavior.

### Rule 3 — no consumer redesign

Keep map and panel UI surfaces functionally the same.
This PR is about source-of-truth closure, not surface redesign.

### Rule 4 — additive and backward-compatible

Preserve compatibility for old rows and incomplete payloads.
Do not require a full migration to render historical sessions.

### Rule 5 — no new semantic field family

Do not create a second parallel display schema.
Close around the existing canonical field family.

---

## Acceptance criteria

1. Fresh session plans expose the canonical display field family all the way through summary/bootstrap/hydration without needing parallel semantic reconstruction.
2. Map and panel consume the same canonical display truth family for fresh paths.
3. Read-time display reconstruction remains only as fallback/recovery for legacy or partial payloads.
4. Older historical rows still render correctly.
5. No generator semantics, onboarding semantics, scoring semantics, or map UI redesigns are introduced.

---

## Regression risks

### Risk 1 — over-trusting incomplete plan meta

If pass-through assumes fields always exist, partial/legacy plans may render blank labels.

Mitigation:

- keep recovery logic intact,
- use pass-through first, recovery second.

### Risk 2 — duplicated truth still survives in helper paths

If helpers still silently reconstruct fresh canonical paths, closure will remain incomplete.

Mitigation:

- explicitly narrow when helper derivation is used,
- preserve it only for incomplete payloads.

### Risk 3 — hidden contract drift between summary/bootstrap/hydration

If one API path still omits or reconstructs fields differently, the closure is incomplete.

Mitigation:

- audit all near-surface read paths,
- keep the field family consistent end-to-end.

---

## Done means

This PR is done when fresh session display meaning is written once, echoed through summary/bootstrap/hydration, and consumed by both map and panel without each layer having to reinvent the same semantic truth.
