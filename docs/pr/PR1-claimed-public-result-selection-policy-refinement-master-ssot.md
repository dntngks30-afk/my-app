# PR1 — Claimed Public Result Selection Policy Refinement (Master SSOT)

> Parent SSOT: `docs/pr/PR-POST-52-FOLLOWUP-PRIORITIES-SSOT.md`
> Scope type: source-selection truth only
> Goal: ensure the session-create pipeline selects the right current public result truth before any composition logic begins

---

## Why this PR exists

PR #52 improved session 1 alignment **after** a public result has already been selected.
That means the higher-order truth is still the selected public result itself.
If the wrong claimed public result wins, downstream composition can still feel believable but directionally stale.

The current residual risk is simple:

> a stale refined result can still beat a fresher baseline simply because the system is biased toward refined-first selection.

PR1 exists to correct that selection truth without mixing in composition changes.

---

## Product law protected

**Current state truth must win before composition logic begins.**

The user should feel:

- “The system is using the result I just saw.”
- “My first session follows my current state, not an older state.”
- “Analysis really continues into execution.”

---

## Locked implementation direction

PR1 owns only the claimed-public-result selection layer.

It may refine:

- `getLatestClaimedPublicResultForUser`
- the ranking / tie-break policy used to choose one claimed public result for execution truth
- the trace / observability needed to explain why that result won

It must explicitly consider:

- `stage` (`baseline` vs `refined`)
- freshness
- `claimedAt`
- `createdAt`
- execution suitability

It must **not** collapse into:

- naive refined-first only
- naive latest-only
- session composition rewrite

---

## Non-goals

This master PR must not do any of the following:

- no plan-generator tuning
- no first-session quality rewrite
- no renderer/UI rewrite
- no onboarding/auth/payment changes
- no adaptive/session 2+ logic change
- no phase semantics rewrite

---

## Required conceptual separation

PR1 is about **what truth won**.
It is not about **whether the generated output honored that truth**.

Therefore:

- PR1 must not redefine `alignment_audit`
- PR1 must not redefine `selected_truth_trace` into a composition-quality block
- PR1 may update selected-truth trace only insofar as it explains the selection policy outcome

---

## Canonical child-PR slicing guidance

PR1 should be split into narrow child PRs rather than implemented as one large change.
Recommended order:

1. selection case-table / policy lock
2. stale-refined vs fresh-baseline tie-break correction
3. selection reason trace strengthening
4. execution-suitability tie-break refinement

One child PR = one selection ownership problem.

---

## Regression proof requirements

Any child PR under PR1 is acceptable only if all of the following remain true:

1. session-create still works for claimed public result and legacy fallback paths
2. no session composition semantics change
3. no user-facing route semantics change
4. the chosen public result becomes more explainable, not less
5. the system is less likely to use stale truth when fresher truth exists

---

## What “done” means

PR1 is done when the system more reliably selects the right current claimed public result for execution truth, and that selection is explainable without dragging composition logic into the same PR.

---

## Final canonical statement

PR1 is the source-selection truth PR.
It decides which claimed public result should own execution truth right now.
It must stay narrowly focused on selection policy and must not drift into first-session quality tuning.
