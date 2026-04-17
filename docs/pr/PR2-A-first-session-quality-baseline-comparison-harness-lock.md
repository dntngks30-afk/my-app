# PR2-A — First-Session Quality Baseline / Comparison Harness Lock

> Parent SSOT: `docs/pr/PR-POST-52-FOLLOWUP-PRIORITIES-SSOT.md`
> Master SSOT: `docs/pr/PR2-first-session-quality-tuning-master-ssot.md`
> Scope type: first-session felt-quality baseline and comparison harness only

---

## Purpose

PR2-A is the first child PR under PR2.
It owns exactly one problem:

> before tuning anchor-specific session 1 quality, the repo must have a narrow baseline/comparison harness that makes felt-quality regressions visible by anchor type.

PR2 is about making session 1 feel more distinctly aligned after the correct current truth has already been selected. That tuning becomes risky if there is no stable way to compare anchor-specific outputs before and after narrow quality changes.

PR2-A exists to lock that harness first and nothing wider.

---

## Scope

This PR may do only the minimum needed to make first-session quality differences inspectable and regression-testable by anchor type.

Allowed work:
- add a focused session-1 comparison harness or smoke script
- add narrow fixture inputs for representative anchor types
- expose or snapshot only the composition outputs needed to compare first-session felt quality
- add minimal observability fields only if strictly needed to explain anchor-specific composition differences

---

## Non-goals

PR2-A must not do any of the following:

- no claimed public result selection rewrite
- no session 1 quality tuning yet
- no lower / upper / trunk / deconditioned behavior change yet
- no generator safety guardrail weakening
- no phase semantic rewrite
- no onboarding/auth/payment/UI changes
- no audit-contract redesign
- no trace-contract redesign beyond the minimum needed for harness visibility

---

## Problem statement to lock

Right now, first-session quality tuning can easily become subjective or drift across anchors unless the project can compare representative session-1 outputs in a stable, repeatable way.

PR2-A must create the narrow harness that lets later child PRs prove statements like:
- lower instability now feels more distinct from lower mobility restriction,
- upper mobility now expresses its direction more clearly,
- trunk/core no longer feels generically safe,
without mixing all anchor tuning into one PR.

---

## Locked truths

### T1. PR2 assumes truth selection is already correct
PR2-A must not revisit PR1 source-selection ownership.

### T2. Harness first, tuning later
This PR exists to make later anchor-specific quality tuning measurable, not to change session feel yet.

### T3. Phase semantics remain intact
The harness must not reinterpret `Prep` as `Main` or otherwise blur phase meaning.

### T4. Safety guardrails remain intact
The harness may observe difficulty / safety / pain constraints, but may not weaken them.

### T5. Anchor-isolated comparison is required
The harness must make it possible to inspect first-session differences by anchor type, not just through one aggregate output.

---

## Canonical implementation direction

PR2-A should add a comparison harness that makes representative first-session outputs visible for at least these anchor groups:
- `LOWER_INSTABILITY`
- `LOWER_MOBILITY_RESTRICTION`
- `UPPER_IMMOBILITY`
- `CORE_CONTROL_DEFICIT`
- `DECONDITIONED`
- `STABLE`

The harness may inspect things like:
- first-session intent / rationale
- segment composition shape
- main vs prep balance
- anchor-facing emphasis signals
- obvious genericity vs distinctness markers

But it must remain a harness, not a tuning PR.

---

## Files expected to change

Likely:
- a narrow script under `scripts/`
- fixture or helper files directly supporting that script
- minimal session-summary/inspection helper if needed

Not expected:
- broad generator logic changes
- anchor-specific composition rules
- UI renderer work
- readiness/auth/onboarding/payment files

---

## Regression proof

PR2-A is acceptable only if all of the following are true:

1. representative session-1 outputs can be compared by anchor type
2. no selected-truth ownership behavior changes
3. no phase semantic changes
4. no pain/safety/difficulty guardrail changes
5. later child PRs can use this harness to prove narrow felt-quality improvements per anchor

---

## Residual risks intentionally left out

PR2-A does not yet solve:
- lower pair separation
- upper mobility expressiveness
- trunk/core distinctness
- deconditioned/stable polish
- cross-anchor final polish

Those belong to later child PRs.

---

## Final canonical statement

PR2-A is the first-session quality harness PR.
It does not tune session 1 yet. It locks the baseline comparison surface so later PR2 child PRs can improve one anchor-quality question at a time without hiding regressions inside a mega PR.
