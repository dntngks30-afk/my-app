# PR1-C — Execution Suitability Selection Gate / Trace Lock

> Parent SSOT: `docs/pr/PR-POST-52-FOLLOWUP-PRIORITIES-SSOT.md`
> Master SSOT: `docs/pr/PR1-claimed-public-result-selection-policy-refinement-master-ssot.md`
> Predecessor child SSOTs:
> - `docs/pr/PR1-A-currentness-window-stage-freshness-selection-lock.md`
> - `docs/pr/PR1-B-claimedAt-createdAt-deterministic-tie-break-lock.md`
> Scope type: execution-suitability tie-break + minimal additive selection trace only

---

## Purpose

PR1-C owns exactly one problem:

> when multiple claimed results are still timing-close after PR1-A and PR1-B, the loader should prefer the result that is more suitable to own execution truth, and that choice should be minimally explainable.

This PR is still a **source-selection truth** PR.
It must not drift into generator tuning or alignment-audit redesign.

---

## Scope

Allowed work:
- refine selection preference using explicit execution-suitability signals already available from the claimed result payload/validation path
- skip or demote candidates that are valid enough to parse but less suitable to own execution truth
- add narrow, additive trace fields explaining the suitability-based winner
- add targeted tests for suitability-based tie cases

---

## Non-goals

- no stale-vs-fresh correction work beyond PR1-A
- no claimedAt/createdAt policy redesign beyond PR1-B
- no session composition or generator changes
- no readiness semantic rewrite
- no onboarding/auth/payment/UI changes
- no large trace-contract cleanup beyond minimum additive selection explanation

---

## Problem statement to lock

After stage/currentness and timing are corrected, there can still be cases where multiple claimed rows are all technically valid, but not equally suitable to drive execution truth.

Examples:
- one row passes schema validation but carries weaker execution-relevant shape/metadata
- one row is valid but structurally less trustworthy as the selected execution owner
- one row should be skipped for execution ownership even though it is parseable

Today this distinction is under-specified.

---

## Locked truths

### T1. Parseable is not always equally suitable
A candidate surviving contract validation does not automatically make it equally fit to own execution truth.

### T2. Suitability is still a selection-layer concern here
PR1-C may refine which candidate wins, but may not change how downstream composition interprets the winner.

### T3. Suitability must remain narrow and explainable
This PR must not invent broad scoring or generator behavior inside the loader.

### T4. Additive trace only
Any trace added here must explain which candidate won and why at the source-selection layer only.

---

## Canonical implementation direction

PR1-C should prefer a narrow suitability gate/tie-break such as:

1. consider only candidates that survive existing stage + contract checks
2. compare candidates that remain close after PR1-A / PR1-B
3. prefer the candidate more suitable to own execution truth according to explicit, narrow rules
4. emit minimal additive trace fields such as:
   - selected suitability reason
   - rejected suitability reason
   - winning stage / timing bucket / suitability bucket

Important:
- this is not an audit-layer redesign
- this is not alignment-quality scoring
- this is not a plan-quality policy

---

## Files expected to change

Likely:
- `src/lib/public-results/getLatestClaimedPublicResultForUser.ts`
- narrow helper(s) if cleaner
- tests for suitability-based selection
- minimal additive trace field consumer only if required at the loader boundary

Not expected:
- generator / plan ranking / readiness / onboarding / UI files

---

## Regression proof

1. two timing-close candidates can still resolve deterministically via suitability
2. suitability does not override clearly fresher current truth from PR1-A without explicit rule
3. candidates that are parseable but unsuitable are skipped or demoted predictably
4. loader output remains one stable selected row or `null`
5. no composition logic changes

---

## Final canonical statement

PR1-C is the execution-suitability source-selection PR.
It refines the final tie-break among already-close claimed result candidates and adds only the minimum trace needed to explain why the chosen candidate was more suitable to own execution truth.
