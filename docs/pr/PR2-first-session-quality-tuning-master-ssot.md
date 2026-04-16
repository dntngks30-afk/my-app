# PR2 — First-Session Quality Tuning (Master SSOT)

> Parent SSOT: `docs/pr/PR-POST-52-FOLLOWUP-PRIORITIES-SSOT.md`
> Scope type: first-session composition quality only
> Goal: make session 1 feel more distinctly aligned by anchor type after the correct current public result truth has already been selected

---

## Why this PR exists

Once the right public result is selected, the next strongest product lever is whether session 1 actually feels different by anchor type.
PR #52 made alignment safer, but some cases can still feel too conservative or too generic in practice.

The current residual risk is:

- lower stability vs lower mobility may still feel too similar
- upper mobility may still under-express its intended direction
- trunk/core cases may still feel generically safe rather than distinctly state-led

PR2 exists to improve that first-session felt quality **without** weakening safety or rewriting source-selection truth.

---

## Product law protected

**State-based execution must be felt from session 1, not just explained in text.**

The user should feel:

- “This routine really matches what I was told.”
- “My first session is not generic.”
- “Different result types lead to noticeably different starts.”

---

## Locked implementation direction

PR2 owns only first-session composition quality.

It may tune:

- candidate quality
- anchor-aware composition behavior
- segment emphasis
- intent fit for session 1

It must preserve:

- the PR #52 safety correction
- phase semantics (`Prep` must not be promoted into `Main` semantics)
- pain/safety/difficulty guardrails

---

## Non-goals

This master PR must not do any of the following:

- no claimed public result selection rewrite
- no trace-contract redesign
- no audit-contract redesign
- no onboarding/auth/payment changes
- no adaptive/session 2+ redesign
- no UI/renderer rewrite as the main deliverable

---

## Required conceptual separation

PR2 is about **how session 1 feels after the right truth is selected**.
It is not about deciding **which truth won**.

Therefore:

- PR2 must not rewrite PR1 selection policy
- PR2 must not reinterpret `selected_truth_trace`
- PR2 must not reinterpret `alignment_audit` beyond using it as observability

---

## Canonical child-PR slicing guidance

PR2 should be split into narrow child PRs rather than implemented as one large change.
Recommended order:

1. quality baseline / comparison harness lock
2. lower pair separation only (`LOWER_INSTABILITY` vs `LOWER_MOBILITY_RESTRICTION`)
3. upper mobility expressiveness only
4. trunk/core distinctness only
5. deconditioned / stable polish only
6. cross-anchor final polish

One child PR = one felt-quality question.

---

## Regression proof requirements

Any child PR under PR2 is acceptable only if all of the following remain true:

1. the chosen current truth is not changed by this PR
2. phase semantics remain intact (`Prep` does not silently dominate `Main`)
3. pain/safety/difficulty guardrails are not weakened
4. session 1 becomes more distinct by anchor type, not more generic
5. regressions can still be isolated by anchor type rather than hidden inside a mega PR

---

## What “done” means

PR2 is done when session 1 more clearly feels like a continuation of the selected state truth, with visibly different starts by anchor type, while preserving safety and phase semantics.

---

## Final canonical statement

PR2 is the first-session felt-quality PR.
It assumes the right truth has already been selected and improves how distinctly that truth is expressed in session 1.
It must stay narrowly focused on composition quality and must not drift back into source-selection policy.
