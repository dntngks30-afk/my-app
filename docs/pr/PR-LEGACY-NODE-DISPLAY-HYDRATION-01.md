# PR-LEGACY-NODE-DISPLAY-HYDRATION-01 — Existing-account node display hydration and legacy drift recovery

## Parent SSOT purpose

This document locks the next follow-up direction after the map-node display alignment work (PR1 contract, PR2 node source hierarchy, PR3 shared copy builder).

Its purpose is to solve the remaining product gap:

- newly created or freshly previewed sessions now align better,
- but many **existing accounts with already-created/completed sessions** can still show legacy map labels because old nodes are not hydrated with modern display truth early enough.

This is a **parent SSOT** for follow-up implementation PRs. It is not the implementation itself.

---

## Problem statement

The current map/panel display system is structurally improved, but existing accounts still have a noticeable gap:

1. The map now prefers runtime truth through:
   - active full plan meta
   - plan summary
   - bootstrap meta
   - next preview
   - arc placeholder
   - legacy map-data fallback
2. However, for many old completed sessions, the app still reaches the legacy fallback because no display-specific hydration has happened yet.
3. As a result, old accounts can look only partially updated:
   - newer/current/next nodes may reflect the new display system,
   - older completed nodes may still show legacy static copy.

This creates the user impression that:

- the change applies only to new accounts, or
- only newly generated sessions are updated.

The real issue is not generation. The real issue is **legacy node hydration**.

---

## Product law

Do not solve this by adding more text or more badges to the map.

Keep the current map surface minimal:

- one large role-like label
- one short subtitle

The fix must come from **better hydration of existing-session display truth**, not from more UI.

---

## Core decision

The next required step is to introduce a **display-only hydration path for already-created sessions**, especially completed history, so that old accounts do not depend on per-node on-demand summary fetches or long-lived legacy fallbacks.

The canonical direction is:

1. server-side or bundle-level display hydration for existing session nodes
2. stronger read-time derivation for old rows that do not yet carry explicit display fields
3. optional later backfill for persistent storage cleanup

This document locks the first of those as the immediate priority.

---

## Immediate target problem

Today, completed nodes without hydrated summary can still fall back to legacy map-data copy.

That means the existing hierarchy is correct in principle, but incomplete in practice for old accounts.

The immediate target is therefore:

- **hydrate display truth for completed history earlier**,
- do so in a compact, display-only way,
- avoid N-per-node heavy fetch patterns,
- preserve the current source hierarchy and map UI.

---

## Immediate solution direction

Introduce a **batch display hydration path** for home/reset-map node display.

This hydration path should provide, for relevant session numbers, the minimum display fields needed by the existing map/panel copy system:

- `session_number`
- `session_role_code`
- `session_role_label`
- `session_goal_code`
- `session_goal_label`
- `session_goal_hint`
- optional `session_rationale`
- optional `session_focus_axes`
- optional `priority_vector`
- optional `pain_mode`
- optional `focus`

This is a display-only payload, not a full session-plan payload.

---

## Why this is needed even after PR1–PR3

PR1 established contract and pass-through.
PR2 established node source hierarchy.
PR3 unified copy ownership.

But those changes do **not** automatically rewrite or hydrate the display truth of all already-created historical sessions at home-entry time.

Therefore the current system is structurally correct but still operationally incomplete for old accounts.

---

## Locked implementation principle

The next PR must prefer **batch hydration of existing node display truth** rather than repeated per-node plan-summary fetches.

Acceptable shapes include:

- a dedicated endpoint such as `/api/session/node-display-batch`
- or a compact extension of an existing home/bootstrap owner route

The exact route may vary, but the contract principle is locked:

- compact display-only payload
- idempotent read path
- suitable for existing completed/current/near-next nodes
- no map UI density increase

---

## Scope of the first child PR

The first child PR under this SSOT must solve the user-facing gap for existing accounts as directly as possible.

### In scope

- load display truth for multiple session nodes in one compact read path
- hydrate completed historical nodes so they stop depending on legacy fallback for long periods
- keep current/next behavior compatible with the existing hierarchy
- integrate the hydrated payload into `ResetMapV2` / node resolver without changing semantics of generation or adaptive logic

### Out of scope

- panel redesign
- map layout redesign
- scoring changes
- adaptive engine changes
- session generation ordering changes
- contract vocabulary expansion beyond current bounded sets
- DB-wide destructive migration

---

## Display payload requirements

The hydration payload must be sufficient for the existing shared copy system.

Minimum required fields per hydrated session:

```ts
{
  session_number: number
  session_role_code?: string
  session_role_label?: string
  session_goal_code?: string
  session_goal_label?: string
  session_goal_hint?: string
  session_rationale?: string | null
  session_focus_axes?: string[]
  priority_vector?: Record<string, number>
  pain_mode?: 'none' | 'caution' | 'protected'
  focus?: string[]
}
```

Notes:

- Explicit display contract fields remain canonical when present.
- Legacy rows may still need read-time derivation using the already-locked contract helpers.
- This payload is intentionally lighter than full `plan-summary` or `plan-detail`.

---

## Existing-account behavior goal

After the first child PR:

- an old account entering home should see many more completed nodes rendered with modern role/subtitle copy,
- the map should no longer appear as if only new sessions were updated,
- completed historical nodes should not wait for repeated manual tapping to gradually leave legacy fallback.

---

## Required compatibility rules

The hydration PR must preserve these already-locked truths:

1. active full plan truth still outranks everything for the current session
2. plan summary truth still outranks hydrated fallback if richer/current
3. bootstrap and next preview still serve near-term nodes as before
4. far-future arc placeholder policy remains unchanged
5. legacy map-data remains only a last-resort fallback

In other words, hydration adds earlier truth availability for old accounts; it does **not** change the hierarchy ordering itself.

---

## Child PR roadmap

### Child PR A — Existing-account batch node display hydration

Goal:

- add a compact display-only hydration path for existing completed/current/near-next nodes
- integrate it into home/reset-map so old accounts stop relying heavily on legacy static map text

Expected scope:

- new read route or home-bundle extension
- compact display payload typing
- `ResetMapV2` integration
- resolver input expansion
- no new UI density

### Child PR B — Legacy read-time display derivation hardening

Goal:

- improve read-time derivation for old rows missing explicit display fields
- maximize modern display resolution before falling back to legacy map-data

Expected scope:

- server-side normalization / derivation helpers
- no generation semantic changes

### Child PR C — Persistent backfill for old session rows (optional later)

Goal:

- write missing display fields into old `session_plans.plan_json.meta` rows safely and idempotently

Expected scope:

- backfill script / admin-safe migration path
- no UI changes

---

## Acceptance criteria for the first child PR

1. Existing accounts show modern node display copy for significantly more completed sessions at home entry.
2. The map no longer appears to update only for newly generated sessions.
3. Display hydration is delivered through a compact batch path rather than repeated per-node heavy fetches.
4. The current source hierarchy remains intact.
5. No additional chips, badges, or explanatory clutter are added to the map.
6. Legacy map-data copy remains only a fallback, not the practical default for most old completed nodes.

---

## Non-goals for this parent SSOT

This document does not itself implement:

- node-display vocabulary changes
- panel copy redesign
- map route/layout changes
- scoring or adaptive logic changes
- destructive DB migrations
- wholesale history fetching of full plan payloads

---

## Final product stance

The map/panel alignment work should not feel like a feature that only benefits newly generated sessions.

The next step must make the improved display system visible to **existing users with already-created session history** by hydrating legacy completed nodes with modern display truth early and compactly.
