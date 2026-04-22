# PR-CAM-SQUAT-WAVE-B-FOLLOWUP-CANONICAL-OPENER-REPAIR

## Parent SSOT

- `docs/pr/PR-CAM-SQUAT-SHALLOW-POST-PR6-RESIDUAL-TRUTH-MAP.md`
- `docs/pr/PR-CAM-SQUAT-SHALLOW-POST-PR6-EXECUTION-WAVE-PLAN.md`
- `docs/pr/PR-CAM-SQUAT-WAVE-A-CLOSURE-AUTHORITY-ESTABLISHMENT.md`
- `docs/pr/PR-CAM-SQUAT-WAVE-B-OPENER-UNIFICATION.md`
- `docs/pr/PR-CAM-SQUAT-OFFICIAL-SHALLOW-OWNER-LOCK-SSOT.md`
- `docs/SHALLOW_SQUAT_TRUTH_SSOT_2026_04_01.md`
- `docs/pr/PR-CAM-SQUAT-AUTHORITY-LAW-RESOLUTION.md`
- `docs/PASS_AUTHORITY_RESET_SSOT_20260404.md`
- `docs/pr/PR-RF-02-SQUAT-UI-GATE-ISOLATION.md`

Local note: the first two parent files are present in this checkout but empty. This follow-up is therefore anchored to the user wave lock plus the non-empty owner/authority/pass reset SSOTs above.

## Scope

This follow-up repairs the canonical opener reader only. When Wave A has already closed the official shallow path, the frozen official shallow owner must be consumed as canonical opener truth so that:

- `completionOwnerPassed=true`
- `uiProgressionAllowed=true`
- `finalPassEligible=true`
- `finalPassLatched=true`

The patch is limited to already-closed same-epoch shallow owner truth. It does not create a new closure path and does not make pass-core, the UI gate, or the final sink into an opener.

## Exact Residual Bug

The first Wave B patch aligned trace/effective pass surfaces, but the canonical owner freeze still rechecked `officialShallowClosureProofSatisfied`. That created a split path:

1. Wave A could set `officialShallowPathClosed=true`.
2. A same-rep shallow owner could still be refused by the canonical freeze reader if the legacy proof mirror lagged or was absent.
3. `computeSquatCompletionOwnerTruth()` therefore stayed false before the downstream opener chain could use the closed shallow authority.

The result was an observable split: trace/progression adapters could know about the frozen owner, while the canonical opener still failed to pass the owner truth into final latch.

## Why The First Wave B Patch Was Partial

The first Wave B patch made `readSquatCurrentRepPassTruth()` and squat observability expose the effective opener surface when `officialShallowOwnerFrozen=true`. That helped downstream traces stop disagreeing with frozen owner truth.

It did not repair the canonical owner reader itself. `readSquatPassOwnerTruth()` still depends on `computeSquatCompletionOwnerTruth()`, and `computeSquatCompletionOwnerTruth()` depends on `readOfficialShallowOwnerFreezeSnapshot()`. The residual block lived in that canonical freeze snapshot reader, not in observability.

## What Changed

- `src/lib/camera/squat/squat-progression-contract.ts`
  - `readOfficialShallowOwnerFreezeSnapshot()` now treats `officialShallowPathClosed=true` as the closure authority for opener freeze.
  - The legacy `officialShallowClosureProofSatisfied` mirror is no longer a second hard opener gate after closure has already been established.
  - The existing false-pass guard still runs immediately after the closure authority check and remains the safety perimeter.

- `scripts/camera-pr-cam-squat-official-shallow-owner-freeze-01-smoke.mjs`
  - Added A6-A8 regression coverage for the exact split:
    - closed official shallow path
    - proof mirror false
    - canonical owner still passes
    - final gate opens from canonical owner truth

## Explicitly Not Changed

- No edits to `src/lib/camera/squat/squat-completion-core.ts`.
- No Wave A Family C or closure contract rewrite.
- No UI gate opener change.
- No pass-core raw boolean opener change.
- No observability-only repair.
- No admission timing, arming, anchor provenance, or quality reclassification change.
- No standing/seated/setup/cross-epoch/false-pass guard relaxation.
- No deep standard path semantic change.
- No conditional 11-13 promotion.
- No sink-only invariant assert or Wave C stabilization.
- No bookkeeping status flip before runtime proof.

## Bookkeeping

Bookkeeping was not applied.

Reason: after the runtime repair, the regression harness still reports the current local primary shallow fixture set as `pending_upstream` with no promoted primary fixtures and no promotion candidates. The requested roster flip is therefore still not justified in this checkout.

Direct fixture check: the 10 primary shallow Desktop traces all show `officialShallowPathAdmitted=true`, but none show `officialShallowPathClosed=true`, `completionOwnerPassed=true`, or `finalPassLatched=true`.

Runtime and bookkeeping remain separated: the canonical opener repair is implemented, but `PRIMARY_SHALLOW_FIXTURES` was not promoted because the harness did not prove primary shallow 10/10 final latch green.

## Smoke Result

Green after this follow-up patch:

- `camera-pr-cam-squat-official-shallow-owner-freeze-01-smoke.mjs`: 13/13
- `camera-pr-cam-squat-false-pass-guard-lock-02-smoke.mjs`: 33/33
- `camera-pr-cam-squat-official-shallow-admission-promotion-03-smoke.mjs`: 28/28
- `camera-pr-cam-squat-official-shallow-closure-rewrite-04-smoke.mjs`: 42/42
- `camera-pr-cam-squat-quality-semantics-split-05-smoke.mjs`: 34/34
- `camera-pr-shallow-acquisition-peak-provenance-unify-01-smoke.mjs`: 41/41
- `camera-pr-cam-squat-shallow-temporal-epoch-order-realign-smoke.mjs`: 27/27
- `camera-pr-cam-squat-shallow-arming-cycle-timing-realign-smoke.mjs`: 28/28
- `camera-pr-cam-squat-blended-early-peak-false-pass-lock-01-smoke.mjs`: 18/18
- `camera-pr-cam-squat-regression-harness-lock-06-smoke.mjs`: 69 passed, 0 failed; primary shallow remains 10 `pending_upstream`, promoted 0, promotion candidates 0, loud notices 13.

Checked but still red outside this follow-up diff:

- `camera-pr7-official-shallow-closer-integrity-smoke.mjs`: 39/49
- `camera-pr8-official-shallow-timing-epoch-smoke.mjs`: 45/54
- `camera-pr12-official-shallow-gold-path-convergence-smoke.mjs`: 25/35

Those failures remain in the shallow closure contract expectation surface and were not repaired here because closure contract work is explicitly outside this Wave B follow-up.

## Known Remaining Gap

Wave C stabilization is not included. Sink-only invariant assertions, promoted fixture hardening, conditional 11-13 decisions, and primary shallow fixture promotion remain out of this follow-up.

The local primary shallow fixture set still does not justify the bookkeeping flip. A later scoped step needs either updated real-device traces that actually carry the closed/frozen shallow owner truth through final latch, or a separately authorized fixture/stabilization wave.
