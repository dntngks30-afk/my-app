# PR-RISK-06 — Phase truth wiring for synthetic preview

## Parent SSOT

- Parent: `docs/pr/PR-RESIDUAL-RISK-CLOSURE-SESSION-DISPLAY-ALIGNMENT.md`
- Previous primary chain: `docs/pr/PR-TRUTH-01-map-node-live-truth-hardening.md` through `docs/pr/PR-TRUTH-05-display-ssot-closure.md`

This PR is the first residual-risk closure PR after the main PR-TRUTH-01~05 sequence.

---

## Goal

Replace coarse `sessionNumber -> phase clamp` preview behavior with **true program phase policy wiring** for synthetic next/current display preview, so that near-node role language reflects the real session-phase structure for 8/12/16/20-session programs.

This PR owns **phase truth accuracy for synthetic preview paths** only.

It does not reopen map source hierarchy, generator semantics, or display SSOT closure.

---

## Locked problem statement

Current synthetic preview paths can still derive phase using a coarse approximation such as:

- `phase = clamp(sessionNumber, 1..4)`

This works as a temporary bounded fallback, but it is not the true phase policy for programs with different total-session lengths.

As a result, synthetic near-node preview can still show:

- role progression too early,
- role labels inconsistent with the actual phase schedule,
- map/panel role language that is directionally right but not phase-accurate.

The failure is not catastrophic.
It is **truth-accuracy drift inside preview-only paths**.

---

## Scope

### In scope

- synthetic preview phase resolution for current/next near-node display
- wiring to real program phase policy / total-session-aware phase computation
- reuse of already-existing phase helpers where possible

### Out of scope

- no generator selection changes
- no onboarding semantics changes
- no map UI redesign
- no SessionPanel redesign
- no scoring / pain semantic changes
- no broad display contract redesign

---

## Locked truth

### Truth 1 — synthetic preview must use real phase policy

If preview is synthetic because final session content is not fully materialized yet, it may still be approximate in content,
but its **phase** must follow the same policy as the real program.

### Truth 2 — total sessions matter

Phase resolution must take into account the actual program size, not just session number.

An 8-session program and a 20-session program must not map to phase by the same coarse clamp rule.

### Truth 3 — preview content may remain synthetic, but phase cannot stay arbitrary

This PR does not require fully generated future plans for every node.
It only requires that synthetic role/goal seeding use the right phase owner.

### Truth 4 — fresh canonical display fields still win
n
If active plan / summary / hydration / bootstrap already provide canonical display fields, they remain authoritative.
This PR only affects synthetic preview seed paths.

---

## Required behavior changes

### A. Remove direct sessionNumber clamp from synthetic preview phase seeding

Paths that currently do something like `phase = clamp(sessionNumber, 1..4)` for synthetic preview must instead call a true phase resolver.

### B. Reuse existing phase policy logic

Prefer using the existing phase policy / phase helper stack already used by session creation, rather than introducing a second phase mapping table.

### C. Thread totalSessions into synthetic preview seed paths

Any synthetic preview helper that needs phase must receive enough context to resolve it correctly, including at least:

- `sessionNumber`
- `totalSessions`
- optionally phase policy options if required by the existing helper stack

### D. Preserve bounded fallback behavior

If full phase context is unexpectedly unavailable, fallback may still exist, but it must become the explicit last-resort path rather than the default implementation.

---

## Files expected to change

Primary expected files:

- `src/app/app/(tabs)/home/_components/reset-map-v2/session-node-display.ts`
- `src/lib/session/phase.ts` or nearby phase helper usage sites
- `src/app/app/(tabs)/home/_components/reset-map-v2/ResetMapV2.tsx` if additional context threading is required
- `src/app/app/(tabs)/home/_components/HomePageClient.tsx` only if totalSessions/context pass-through is needed

Possible read-only inspection files:

- `src/app/api/app/bootstrap/route.ts`
- `src/lib/session/home-node-display-bundle.ts`
- `src/lib/session/next-session-preview.ts`

---

## Implementation rules

### Rule 1 — do not invent a new phase system

Reuse the existing canonical phase logic.
Do not create a second independent phase-mapping table unless absolutely unavoidable.

### Rule 2 — only synthetic preview paths

Do not touch active/summary/hydrated canonical display paths.
They already own their truth correctly.

### Rule 3 — keep fallback narrow

A coarse fallback may remain for defensive programming, but it must not remain the primary path.

### Rule 4 — no visual redesign

The user-facing role labels can remain the same vocabulary.
This PR is about correct timing, not new wording.

---

## Acceptance criteria

1. Synthetic next/current preview no longer uses direct `sessionNumber -> phase clamp` as the primary phase source.
2. Preview phase is resolved with total-session-aware program phase logic.
3. 8/12/16/20-session programs can produce different phase-accurate role timing for the same session number where appropriate.
4. Canonical active/summary/hydration display paths remain unchanged.
5. No generator, onboarding, scoring, or UI redesign changes are introduced.

---

## Regression risks

### Risk 1 — missing phase context in some render path

If synthetic preview helper does not receive enough context, phase accuracy may still silently fall back.

Mitigation:

- thread totalSessions explicitly,
- keep fallback visible in code as the exceptional path.

### Risk 2 — phase helper mismatch with UI expectations

If the true phase policy differs from what the map visually implied before, role timing can shift.

Mitigation:

- accept this as a truth correction,
- do not “fix” it back toward the old approximation.

---

## Done means

This PR is done when synthetic preview role language for near nodes reflects the real program phase schedule instead of a coarse session-number approximation.
