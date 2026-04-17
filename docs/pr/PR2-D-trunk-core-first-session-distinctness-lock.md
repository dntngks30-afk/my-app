# PR2-D — Trunk/Core First-Session Distinctness Lock

> Parent SSOT: `docs/pr/PR-POST-52-FOLLOWUP-PRIORITIES-SSOT.md`
> Master SSOT: `docs/pr/PR2-first-session-quality-tuning-master-ssot.md`
> Predecessor child SSOT: `docs/pr/PR2-A-first-session-quality-baseline-comparison-harness-lock.md`
> Scope type: `CORE_CONTROL_DEFICIT` first-session distinctness only

---

## Purpose

PR2-D owns exactly one felt-quality question:

> make `CORE_CONTROL_DEFICIT` session 1 feel distinctly trunk/core-led rather than merely generically safe.

---

## Scope

Allowed work:
- tune first-session composition only for `CORE_CONTROL_DEFICIT`
- improve trunk/core distinctness using the PR2-A harness
- add narrow observability only if required for proof

---

## Non-goals

- no PR1 source-selection work
- no lower-pair tuning
- no upper mobility tuning
- no deconditioned/stable polish
- no cross-anchor mega rewrite
- no guardrail weakening
- no phase semantic rewrite

---

## Locked truths

### T1. Core/trunk cases should not feel generic
They should clearly feel state-led from the first session.

### T2. Distinctness must remain safe
No difficulty/pain guardrail weakening is allowed.

### T3. Core-led distinctness must not be faked through phase drift
Prep and Main semantics must remain intact.

### T4. Improvement must be visible through the harness
This PR should prove a trunk/core-specific difference, not rely on intuition.

---

## Regression proof

1. `CORE_CONTROL_DEFICIT` feels more distinctly trunk/core-led
2. guardrails remain intact
3. phase semantics remain intact
4. other anchors are not broadly retuned

---

## Final canonical statement

PR2-D is the trunk/core distinctness PR.
It exists only to make `CORE_CONTROL_DEFICIT` feel more specifically state-led in session 1 without broad cross-anchor rewrite.
