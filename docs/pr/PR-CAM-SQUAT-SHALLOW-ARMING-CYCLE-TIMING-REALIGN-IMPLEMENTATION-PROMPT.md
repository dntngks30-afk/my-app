# Implementation Prompt — PR-CAM-SQUAT-SHALLOW-ARMING-CYCLE-TIMING-REALIGN

Use GPT-5.4 or an equivalently strong reasoning model.

This session is an **implementation session for the arming/cycle-timing realign branch only**.
It is **not** a new detector-design session.
It is **not** a P4 / E1 promotion session.
It is **not** an authority-law rewrite session.
It is **not** a P2 / P3 cleanup session.

The design SSOT is already locked. Your job is to implement the preferred direction exactly within that design envelope: a **structured arming epoch handoff** that lets canonical shallow cycle timing see the true same-rep pre-arming descent epoch without changing thresholds, fixtures, proof-gate policy, or pass authority.

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
8. current relevant code paths:
   - `src/lib/camera/squat-completion-arming.ts`
   - `src/lib/camera/evaluators/squat.ts`
   - `src/lib/camera/squat-completion-state.ts`
   - `src/lib/camera/squat/squat-completion-core.ts`
   - `src/lib/camera/auto-progression.ts`
9. current relevant smokes:
   - `scripts/camera-pr-cam-squat-shallow-authority-safe-descent-source-expansion-smoke.mjs`
   - `scripts/camera-pr-cam-squat-shallow-authority-safe-descent-source-followup-smoke.mjs`
   - `scripts/camera-pr-01-squat-completion-first-authority-freeze-smoke.mjs`
   - `scripts/camera-pr-e1-shallow-lock-promotion-registry-smoke.mjs`
   - `scripts/camera-pr-f-regression-proof-gate.mjs`

Then inspect the real current code before editing.

---

## Session mission

Implement the preferred design from the SSOT:

**structured arming epoch handoff**

Meaning:
- capture a proof-bearing pre-arming kinematic descent epoch from the full post-readiness `valid` buffer,
- hand it across the arming boundary,
- normalize it with the existing local descent candidates,
- allow canonical shallow cycle timing to derive `cycleDurationMs` from that earlier same-rep epoch,
- while preserving PR-01 completion-first authority and all absurd-pass protections.

This session must implement only the first safe bundle for that design:
- structured epoch capture
- additive handoff plumbing
- normalized descent timing selection
- canonical timing consumption
- additive diagnostics
- smoke coverage for the new timing path

This session must **not** perform registry promotion by default.
This session must **not** unblock P2 / P3 / P4.

---

## Simple explanation of the intended change

The new shallow detector already works.
But the system still starts measuring the squat too late because the completion slice begins after the real shallow descent already started.

This session fixes that by carrying the earlier same-rep descent timestamp across the slice boundary.

Important:
That earlier timestamp is **not** a pass opener.
It only helps canonical completion truth measure cycle timing correctly.
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

Implement a structured pre-arming timing handoff whose shape is conceptually equivalent to:

```ts
preArmingKinematicDescentEpoch = {
  source: 'pre_arming_kinematic_descent_epoch',
  baselineKneeAngleAvg,
  baselineWindowStartValidIndex,
  baselineWindowEndValidIndex,
  descentOnsetValidIndex,
  descentOnsetAtMs,
  descentOnsetKneeAngleAvg,
  completionSliceStartIndex,
  peakGuardValidIndex,
  proof: {
    monotonicSustainSatisfied,
    baselineBeforeOnset,
    onsetBeforeCompletionSlicePeak,
    noStandingRecoveryBetweenOnsetAndSlice,
  },
}
```

You do not have to use this exact type name, but the implemented structure must preserve the same information and proof obligations.

The key rule is:

- the epoch is a **canonical timing candidate only**
- it may influence `descendStartAtMs` and `cycleDurationMs`
- it may never directly set `completionSatisfied`, `completionPassReason`, `completionOwnerReason`, `finalPassEligible`, or any pass-opener field

---

## Allowed scope

Primary expected files:

- `src/lib/camera/squat-completion-arming.ts`
- `src/lib/camera/evaluators/squat.ts`
- `src/lib/camera/squat-completion-state.ts`
- `src/lib/camera/squat/squat-completion-core.ts`

Optional narrow file only if genuinely needed:

- `src/lib/camera/auto-progression.ts` for additive diagnostics mirror only
- one new focused arming/cycle-timing smoke
- one narrow stop-report doc in `docs/pr/*`

Strong default:
Assume this should be solved in the four runtime files above plus the minimum smoke surface.

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
- identifying the pre-arming timing epoch candidate from full `valid`
- computing valid-buffer indices and timestamps
- proving the baseline window precedes the onset
- exposing an additive handoff payload

### Completion-core may own
- normalizing local slice candidates and pre-arming candidates into one coordinate system
- selecting the earliest accepted canonical descent timing epoch
- deriving `descendStartAtMs`
- deriving `cycleDurationMs`
- rejecting stale / mixed / incoherent epochs

### Completion-core may NOT own
- direct final pass writes from the pre-arming epoch
- pass-core semantics rewrite
- registry promotion

### Evaluator may own
- plumbing the structured handoff from `valid` + arming boundary into completion-state
- additive diagnostics

### Final pass surface may own
- nothing new in this session

---

## Required implementation rules

### Rule 1 — structured handoff, not bare scalar
Do not implement this as only `seedDescentStartAtMs` or another bare timestamp.
The handoff must include enough structure to prove same-rep integrity.

### Rule 2 — normalized coordinate system
You must compare local slice candidates and pre-arming candidates in one normalized coordinate system.
Local slice index `0` and pre-slice valid index `0` are not interchangeable.
Use valid-buffer indices and/or timestamps consistently.

### Rule 3 — same-rep proof is mandatory
The pre-arming epoch is valid only if you can prove:
1. baseline window precedes onset
2. onset precedes the same rep peak
3. onset belongs to the same post-readiness `valid` buffer
4. no standing recovery reset occurs between onset and slice start
5. the resulting descent/peak/reversal/recovery ordering is coherent

### Rule 4 — fail closed on uncertainty
If the pre-arming epoch cannot be proven same-rep safe, ignore it and preserve current behavior.

### Rule 5 — keep current detector family intact
Do not redesign Source #4.
This session is about carrying its earlier timing truth across the arming boundary, not inventing a new detector family.

---

## Exact runtime goals

After the implementation, the system should conceptually behave like:

```ts
selectedCanonicalDescentTimingEpoch = earliestAcceptedByNormalizedOrder([
  phaseHintDescentEpoch,
  trajectoryDescentStartEpoch,
  sharedDescentEpoch,
  legitimateKinematicShallowDescentOnsetEpoch,
  preArmingKinematicDescentEpoch,
])

descendStartAtMs = selectedCanonicalDescentTimingEpoch.timestampMs
cycleDurationMs = standingRecoveredAtMs - selectedCanonicalDescentTimingEpoch.timestampMs
```

Important constraints:
- the selected epoch may be pre-slice
- reversal, recovery, closure, and final pass still come from completion-owner truth plus allowed vetoes
- the pre-arming epoch cannot create success by itself

---

## Mandatory additive diagnostics

You must add or extend diagnostics so the new boundary behavior is auditable.

At minimum expose enough to answer all of these questions on a failing or passing shallow rep:

1. Was a pre-arming epoch candidate found?
2. What valid-buffer index and timestamp did it use?
3. Why was it accepted or rejected?
4. Which candidate ultimately won canonical timing?
5. Was the selected timing epoch pre-slice or in-slice?
6. Was normalized-anchor coherence satisfied?
7. Did canonical shallow contract drive pass?

Recommended additive diagnostics include fields conceptually equivalent to:
- `preArmingKinematicDescentEpochValidIndex`
- `preArmingKinematicDescentEpochAtMs`
- `preArmingKinematicDescentEpochAccepted`
- `preArmingKinematicDescentEpochRejectedReason`
- `selectedCanonicalDescentTimingEpochSource`
- `selectedCanonicalDescentTimingEpochValidIndex`
- `selectedCanonicalDescentTimingEpochAtMs`
- `normalizedDescentAnchorCoherent`

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

The pre-arming epoch may help canonical timing, but it may not reopen any absurd-pass family.

---

## Smoke / validation requirements

If you land a fix, you must run and report at minimum:

1. `scripts/camera-pr-cam-squat-shallow-authority-safe-descent-source-expansion-smoke.mjs`
2. `scripts/camera-pr-cam-squat-shallow-authority-safe-descent-source-followup-smoke.mjs`
3. `scripts/camera-pr-01-squat-completion-first-authority-freeze-smoke.mjs`
4. `scripts/camera-pr-e1-shallow-lock-promotion-registry-smoke.mjs`
5. `scripts/camera-pr-f-regression-proof-gate.mjs`
6. one new focused arming/cycle-timing smoke for this branch

The new smoke must prove, for BOTH representative fixtures:
- pre-arming epoch candidate exists
- pre-arming epoch is accepted for the right reason
- selected canonical timing epoch is earlier than slice-local `0`
- `cycleDurationMs >= 800`
- `canonicalShallowContractBlockedReason !== 'minimum_cycle_timing_blocked'`
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
8. the implementation only works by hiding uncertainty instead of proving the epoch

Recommended stop-report path:
- `docs/pr/PR-CAM-SQUAT-SHALLOW-ARMING-CYCLE-TIMING-REALIGN-BLOCKED-REPORT.md`

The stop report must state exactly which stop condition fired.

---

## Output requirements

### If a legal implementation lands
Provide:
1. exact files changed
2. exact structured handoff shape implemented
3. exact ownership/path of the new pre-arming epoch
4. how normalized timing selection works after the change
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

Implement the structured arming epoch handoff so canonical shallow cycle timing can see the true same-rep pre-arming descent epoch, but do not change thresholds, fixtures, authority law, pass-core opener semantics, or promotion state unless every canonical promotion condition truly turns green.