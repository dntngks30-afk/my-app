# Implementation Prompt — PR-CAM-SQUAT-SHALLOW-TEMPORAL-EPOCH-ORDER-REALIGN

Use GPT-5.4 or an equivalently strong reasoning model.

This session is an **implementation session for temporal epoch-order realignment only**.
It is **not** a new detector-design session.
It is **not** a P4 / E1 promotion session.
It is **not** an authority-law rewrite session.
It is **not** a P2 / P3 cleanup session.

The design SSOT is already locked. Your job is to implement the preferred direction exactly within that design envelope: a **structured normalized epoch-order ledger** that lets canonical shallow close reason about descent, peak, reversal, and recovery in one same-rep valid-buffer coordinate system without changing thresholds, fixtures, proof-gate policy, registry state, or pass authority.

---

## Required reading order

Read these files first and treat them as binding, in this order:

1. `docs/SSOT_SQUAT_COMPLETION_FIRST_QUALITY_STRICT_2026_04.md`
2. `docs/pr/PR-SQUAT-COMPLETION-FIRST-QUALITY-STRICT-TRUTH-MAP-01.md`
3. `docs/pr/PR-01-SQUAT-COMPLETION-FIRST-AUTHORITY-FREEZE.md`
4. `docs/pr/PR-CAM-SQUAT-SHALLOW-AUTHORITY-SAFE-DESCENT-SOURCE-EXPANSION.md`
5. `docs/pr/PR-CAM-SQUAT-SHALLOW-AUTHORITY-SAFE-DESCENT-SOURCE-FOLLOWUP-FIX-REPORT.md`
6. `docs/pr/PR-E1-P4-SHALLOW-PROMOTION-BLOCKED-REPORT.md`
7. `docs/pr/PR-CAM-SQUAT-SHALLOW-ARMING-CYCLE-TIMING-REALIGN.md`
8. `docs/pr/PR-CAM-SQUAT-SHALLOW-TEMPORAL-EPOCH-ORDER-REALIGN.md`
9. current relevant code paths:
   - `src/lib/camera/squat-completion-arming.ts`
   - `src/lib/camera/evaluators/squat.ts`
   - `src/lib/camera/squat-completion-state.ts`
   - `src/lib/camera/squat/squat-completion-core.ts`
   - `src/lib/camera/auto-progression.ts`
10. current relevant smokes:
   - `scripts/camera-pr-cam-squat-shallow-authority-safe-descent-source-expansion-smoke.mjs`
   - `scripts/camera-pr-cam-squat-shallow-authority-safe-descent-source-followup-smoke.mjs`
   - `scripts/camera-pr-cam-squat-shallow-arming-cycle-timing-realign-smoke.mjs`
   - `scripts/camera-pr-01-squat-completion-first-authority-freeze-smoke.mjs`
   - `scripts/camera-pr-e1-shallow-lock-promotion-registry-smoke.mjs`
   - `scripts/camera-pr-f-regression-proof-gate.mjs`

Then inspect the real current code before editing.

---

## Session mission

Implement the preferred design from the SSOT:

**structured normalized epoch-order ledger**

Meaning:
- keep the existing selected canonical descent timing epoch,
- normalize peak / reversal / recovery into the same valid-buffer coordinate system,
- build one same-rep temporal ledger for canonical shallow close,
- derive temporal legality from that ledger instead of from loosely related scalar timestamps,
- while preserving PR-01 completion-first authority and all absurd-pass protections.

This session must implement only the first safe bundle for that design:
- normalized epoch ledger capture
- local-to-valid rebasing for peak / reversal / recovery
- ordering-proof evaluation
- canonical close consumption of that ordering result
- additive diagnostics
- smoke coverage for the new temporal-order path

This session must **not** perform registry promotion by default.
This session must **not** unblock P2 / P3 / P4.

---

## Simple explanation of the intended change

The system can already see the shallow squat early enough.
But pass is still blocked because peak, reversal, and recovery are not yet being compared against that early descent inside one clean same-rep time model.

This session fixes that by creating one normalized time ledger for the rep.

Important:
That ledger is **not** a pass opener.
It only helps canonical completion truth decide whether the rep's timing/order is legally complete.
Final pass must still be opened only by completion-owner truth.

---

## Non-negotiable product law

These are absolute. Do not violate them.

1. completion-owner truth is the only opener of final pass
2. pass-core / shallow-assist / closure-proof / bridge / event-cycle are not openers
3. absurd-pass registry remains block-only
4. threshold relaxation is forbidden
5. quality truth remains separate from pass truth

If your implementation requires violating any of the above, stop and do not patch around it.

---

## Exact implementation target

Implement a structured normalized epoch-order ledger conceptually equivalent to:

```ts
canonicalTemporalEpochLedger = {
  repCoordinateSystem: 'valid_buffer',
  descent: {
    source: selectedCanonicalDescentTimingEpochSource,
    validIndex,
    timestampMs,
  },
  peak: {
    source: 'completion_core_peak',
    validIndex,
    timestampMs,
    localIndex,
  },
  reversal: {
    source: 'rule_or_hmm_reversal_epoch',
    validIndex,
    timestampMs,
  },
  recovery: {
    source: 'standing_recovery_finalize_epoch',
    validIndex,
    timestampMs,
  },
  proof: {
    sameValidBuffer: true,
    sameRepBoundary: true,
    baselineBeforeDescent: true,
    descentBeforePeak: true,
    peakBeforeReversal: true,
    reversalBeforeRecovery: true,
    noRecoveryResetBetweenDescentAndPeak: true,
  },
}
```

You do not have to use this exact type name, but the implemented structure must preserve the same information and proof obligations.

Key rule:
- the ledger is a **canonical close guard only**
- it may influence temporal legality and `canonicalShallowContractBlockedReason`
- it may never directly set `completionSatisfied`, `completionOwnerReason`, `finalPassEligible`, or any pass-opener field by itself

Canonical close may consume the ledger result. The ledger itself is not pass ownership.

---

## Allowed scope

Primary expected files:

- `src/lib/camera/squat/squat-completion-core.ts`
- `src/lib/camera/squat-completion-state.ts`
- `src/lib/camera/evaluators/squat.ts`

Optional narrow files only if genuinely needed:

- `src/lib/camera/auto-progression.ts` for additive diagnostics mirror only
- one new focused temporal-order smoke
- one narrow stop-report doc in `docs/pr/*`

Strong default:
Assume this should be solved in the core/state/evaluator path plus the minimum smoke surface.

---

## Forbidden scope

Do **not** do any of the following:

- no threshold changes of any kind
- no lowering `SHALLOW_OFFICIAL_CLOSE_MIN_CYCLE_MS`
- no lowering `attemptAdmissionFloor`
- no widening Source #4 parameter bands
- no changes to `KNEE_DESCENT_ONSET_EPSILON_DEG = 5.0`
- no changes to `KNEE_DESCENT_ONSET_SUSTAIN_FRAMES = 2`
- no fixture re-derivation or fixture edits
- no fake `phaseHint` injection
- no pass-core opener revival
- no authority-law rewrite
- no P4 / E1 registry promotion edits by default
- no P3 registry normalization
- no P2 naming/comment cleanup
- no PR-F skip-marker expansion
- no non-squat work
- no broad camera-stack rewrite

If the only way to succeed is one of the above, stop.

---

## Required ownership model

Your implementation must respect the SSOT's ownership split.

### Arming layer may own
- pre-arming descent epoch capture and proof
- completion slice boundary
- valid-buffer coordinates for the pre-arming timing epoch

### Evaluator handoff may own
- additive plumbing of arming boundary metadata and slice start
- packaging of local-to-valid normalization context
- additive diagnostics

### Completion-core ordering layer may own
- normalization of descent / peak / reversal / recovery into one valid-buffer coordinate system
- same-rep ordering proof
- specific temporal-order reject reasons
- one ledger result or equivalent canonical order output

### Completion-core ordering layer may NOT own
- direct final pass writes
- pass-core semantics rewrite
- registry promotion

### Canonical close layer may own
- consumption of the ledger result
- derivation of `temporal_epoch_order_blocked`
- only after same-rep ordering proof has succeeded

### Final pass surface may own
- nothing new in this session

---

## Required implementation rules

### Rule 1 — structured ledger, not scalar patching
Do not solve this by ad-hoc scalar comparisons scattered through the code.
Build one structured normalized ordering result or equivalent internal object.

### Rule 2 — valid-buffer normalization only
You must compare descent / peak / reversal / recovery inside one normalized valid-buffer coordinate system.
Local indices, timestamps, and pre-slice indices must not be mixed informally.

### Rule 3 — same-rep proof is mandatory
The ledger is valid only if you can prove:
1. baseline precedes selected descent
2. selected descent precedes peak
3. peak precedes reversal
4. reversal precedes recovery
5. all epochs belong to the same post-readiness valid buffer
6. no standing recovery reset occurs between selected descent and peak

### Rule 4 — fail closed on uncertainty
If any epoch cannot be normalized safely, or any same-rep proof bit is missing, ordering must fail closed.
Do not hide uncertainty behind broader success semantics.

### Rule 5 — keep current detector family intact
Do not redesign Source #4 or the pre-arming handoff. This session is about ordering those epochs correctly, not inventing a new timing source.

### Rule 6 — gold-path reversal only for ordering
Bridge/proof-only reversal signals may remain diagnostics, but they must not become the owned reversal epoch for canonical ordering unless the approved owner path also confirms them.

---

## Exact runtime goals

After the implementation, the system should conceptually behave like:

```ts
canonicalTemporalEpochLedger = normalizeSameRepEpochs({
  descent: selectedCanonicalDescentTimingEpoch,
  peak: completionCorePeak,
  reversal: authoritativeReversalEpoch,
  recovery: authoritativeRecoveryEpoch,
  completionSliceStartIndex,
})

canonicalTemporalEpochOrderSatisfied =
  canonicalTemporalEpochLedger.proof.sameValidBuffer &&
  canonicalTemporalEpochLedger.proof.sameRepBoundary &&
  canonicalTemporalEpochLedger.proof.baselineBeforeDescent &&
  canonicalTemporalEpochLedger.proof.descentBeforePeak &&
  canonicalTemporalEpochLedger.proof.peakBeforeReversal &&
  canonicalTemporalEpochLedger.proof.reversalBeforeRecovery &&
  canonicalTemporalEpochLedger.proof.noRecoveryResetBetweenDescentAndPeak
```

Then canonical close may use:

```ts
if (!canonicalTemporalEpochOrderSatisfied) {
  blockedReason = 'temporal_epoch_order_blocked'
}
```

Important constraints:
- ordering success is required for close, but is not pass ownership
- reversal, recovery, completion, and final pass still remain owned by completion-owner truth plus allowed vetoes
- the ledger cannot create success by itself

---

## Mandatory additive diagnostics

You must add or extend diagnostics so the new ordering behavior is auditable.

At minimum expose enough to answer all of these questions on a failing or passing shallow rep:

1. Was a canonical temporal ledger formed?
2. What valid-buffer indices/timestamps were used for descent / peak / reversal / recovery?
3. Why was the ledger accepted or rejected?
4. Which exact ordering proof bit failed?
5. Was the peak normalized from slice-local coordinates correctly?
6. Was reversal a true post-peak authoritative epoch or just a diagnostic signal?
7. Was recovery mapped to the current rep's finalize epoch?
8. Did canonical shallow contract drive pass?

Recommended additive diagnostics include fields conceptually equivalent to:
- `canonicalTemporalEpochOrderSatisfied`
- `canonicalTemporalEpochOrderBlockedReason`
- `selectedCanonicalPeakEpochValidIndex`
- `selectedCanonicalPeakEpochAtMs`
- `selectedCanonicalPeakEpochSource`
- `selectedCanonicalReversalEpochValidIndex`
- `selectedCanonicalReversalEpochAtMs`
- `selectedCanonicalReversalEpochSource`
- `selectedCanonicalRecoveryEpochValidIndex`
- `selectedCanonicalRecoveryEpochAtMs`
- `selectedCanonicalRecoveryEpochSource`
- `temporalEpochOrderTrace`

Do not remove existing diagnostics unless absolutely necessary.
Prefer additive debug over churn.

---

## Mandatory proof obligations

Your implementation must remain safe against all of the following:

- standing still
- setup-motion contaminated pass
- no real descent
- contaminated early-peak false pass
- stale prior rep leakage
- mixed-rep timestamp contamination
- no real reversal
- no real recovery
- hidden split-brain where `completionTruthPassed === false` but final pass becomes true

The ledger may help canonical close, but it may not reopen any absurd-pass family.

---

## Smoke / validation requirements

If you land a fix, you must run and report at minimum:

1. `scripts/camera-pr-cam-squat-shallow-authority-safe-descent-source-expansion-smoke.mjs`
2. `scripts/camera-pr-cam-squat-shallow-authority-safe-descent-source-followup-smoke.mjs`
3. `scripts/camera-pr-cam-squat-shallow-arming-cycle-timing-realign-smoke.mjs`
4. `scripts/camera-pr-01-squat-completion-first-authority-freeze-smoke.mjs`
5. `scripts/camera-pr-e1-shallow-lock-promotion-registry-smoke.mjs`
6. `scripts/camera-pr-f-regression-proof-gate.mjs`
7. one new focused temporal-order smoke for this branch

The new smoke must prove, for BOTH representative fixtures:
- pre-arming descent epoch still exists and remains accepted
- selected canonical descent timing epoch remains `pre_arming_kinematic_descent_epoch`
- peak epoch is normalized into valid-buffer coordinates
- reversal epoch is strictly after peak
- recovery epoch is strictly after reversal
- `canonicalTemporalEpochOrderSatisfied === true`
- `canonicalShallowContractBlockedReason !== 'temporal_epoch_order_blocked'`
- no absurd-pass family flips to pass

And you must confirm:
- PR-01 invariants remain green
- no new conditional skip markers were introduced
- no registry mutation was required for the implementation bundle itself

---

## Promotion boundary for this session

Strong default: **do not edit E1 registry states in this session.**

You may only touch promotion state if — and only if — ALL of the following become true as a direct consequence of this implementation:

1. BOTH representative fixtures now satisfy:
   - `completionTruthPassed === true`
   - `finalPassEligible === true`
   - `finalPassLatched === true`
   - `canonicalShallowContractDrovePass === true`
2. E1 smoke can be updated without weakening any assertion
3. PR-01 smoke remains green
4. absurd-pass smokes remain green
5. no threshold, fixture, authority, or proof-gate change was needed

If any one of those is missing, do not promote here. Leave E1 unchanged and report the new state.

---

## Explicit stop conditions

Stop immediately, rollback runtime edits, and produce one stop-report doc if any of these are true:

1. the required fix would need threshold relaxation
2. the required fix would need fixture edits or fixture cheat
3. the required fix would need authority-law rewrite
4. the required fix would need pass-core opener revival
5. normalized same-rep ordering cannot be proven safely inside current scope
6. any absurd-pass family reopens
7. PR-01 illegal-state smoke regresses
8. the implementation only works by hiding uncertainty instead of proving order

Recommended stop-report path:
- `docs/pr/PR-CAM-SQUAT-SHALLOW-TEMPORAL-EPOCH-ORDER-REALIGN-BLOCKED-REPORT.md`

The stop report must state exactly which stop condition fired.

---

## Output requirements

### If a legal implementation lands
Provide:
1. exact files changed
2. exact ledger shape implemented
3. how peak / reversal / recovery are normalized into valid-buffer coordinates
4. how canonical close now consumes ordering result
5. what additive diagnostics were added
6. smoke results
7. whether BOTH representative fixtures now satisfy all canonical promotion bits
8. whether promotion remains blocked or is now legitimately unblocked
9. residual risks left for later sessions

### If you stop
Provide:
1. exact stop reason
2. why the fix would have exceeded scope
3. confirmation that runtime edits were rolled back or not applied
4. path of the stop-report doc

---

## One-line lock

Implement a structured normalized epoch-order ledger so canonical shallow close can evaluate pre-arming descent, peak, reversal, and recovery inside one same-rep valid-buffer ordering contract, but do not change thresholds, fixtures, authority law, pass-core opener semantics, or promotion state unless every canonical promotion condition truly turns green.