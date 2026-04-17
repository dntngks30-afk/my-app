# PR2-B — Lower Pair First-Session Separation Lock

> Parent SSOT: `docs/pr/PR-POST-52-FOLLOWUP-PRIORITIES-SSOT.md`
> Master SSOT: `docs/pr/PR2-first-session-quality-tuning-master-ssot.md`
> Predecessor child SSOT: `docs/pr/PR2-A-first-session-quality-baseline-comparison-harness-lock.md`
> Scope type: `LOWER_INSTABILITY` vs `LOWER_MOBILITY_RESTRICTION` first-session felt separation only

---

## Purpose

PR2-B owns exactly one felt-quality question:

> make session 1 feel more clearly different between `LOWER_INSTABILITY` and `LOWER_MOBILITY_RESTRICTION` without weakening safety or collapsing phase semantics.

This is the highest-value anchor pair because users can still feel these two starts as too similar even when the selected truth is correct.

---

## Scope

Allowed work:
- tune anchor-aware first-session composition only for `LOWER_INSTABILITY`
- tune anchor-aware first-session composition only for `LOWER_MOBILITY_RESTRICTION`
- use the PR2-A harness to prove their distinctness
- add narrow observability only if needed to explain the separation

---

## Non-goals

- no PR1 source-selection rewrite
- no upper mobility tuning
- no trunk/core tuning
- no deconditioned/stable polish
- no cross-anchor mega rewrite
- no guardrail weakening
- no phase semantic rewrite

---

## Locked truths

### T1. The lower pair must not feel interchangeable
Users should not feel that both anchors lead to the same first-session start.

### T2. `LOWER_INSTABILITY` should feel more control/stability-led
But still inside safety guardrails.

### T3. `LOWER_MOBILITY_RESTRICTION` should feel more mobility/access-led
But without smuggling prep semantics into main semantics.

### T4. Distinctness must be observable via the PR2-A harness
This PR must prove separation through anchor-isolated comparison, not intuition alone.

---

## Canonical implementation direction

PR2-B should tune only the lower-pair composition question by adjusting narrow anchor-aware composition behavior such as:
- session 1 intent fit
- segment emphasis
- candidate preference
- anchor-facing rationale signals

But must remain limited to the lower pair.

---

## Regression proof

1. `LOWER_INSTABILITY` and `LOWER_MOBILITY_RESTRICTION` outputs become more distinct
2. safety/difficulty guardrails remain intact
3. phase semantics remain intact
4. other anchors are not broadly retuned in the same PR

---

## Final canonical statement

PR2-B is the lower-pair separation PR.
It exists only to make session 1 feel more clearly different between instability-led and mobility-restriction-led lower-body starts.
