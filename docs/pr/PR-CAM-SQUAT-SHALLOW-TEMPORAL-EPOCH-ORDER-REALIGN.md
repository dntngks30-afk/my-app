# PR-CAM-SQUAT-SHALLOW-TEMPORAL-EPOCH-ORDER-REALIGN - Design SSOT

> **Session type**: docs-only design SSOT.
>
> **Scope lock**: no `src/*`, no `scripts/*`, no threshold, no fixture, no
> authority-law, no proof-gate, no registry, no P2/P3/P4 work. This document
> is the sole intended output of this session.
>
> **Decision**: prefer a **structured normalized epoch-order ledger**. The next
> implementation branch should normalize descent, peak, reversal, and recovery
> into one valid-buffer epoch ledger before canonical shallow close derives
> temporal legality. Ordering success is a close guard only; it is not pass
> ownership.

## References

- Parent squat SSOT: `docs/SSOT_SQUAT_COMPLETION_FIRST_QUALITY_STRICT_2026_04.md`
- Truth map: `docs/pr/PR-SQUAT-COMPLETION-FIRST-QUALITY-STRICT-TRUTH-MAP-01.md`
- Authority freeze: `docs/pr/PR-01-SQUAT-COMPLETION-FIRST-AUTHORITY-FREEZE.md`
- Source #4 design: `docs/pr/PR-CAM-SQUAT-SHALLOW-AUTHORITY-SAFE-DESCENT-SOURCE-EXPANSION.md`
- Source #4 follow-up fix report: `docs/pr/PR-CAM-SQUAT-SHALLOW-AUTHORITY-SAFE-DESCENT-SOURCE-FOLLOWUP-FIX-REPORT.md`
- E1/P4 blocked report: `docs/pr/PR-E1-P4-SHALLOW-PROMOTION-BLOCKED-REPORT.md`
- Arming/cycle-timing design: `docs/pr/PR-CAM-SQUAT-SHALLOW-ARMING-CYCLE-TIMING-REALIGN.md`
- Arming/cycle-timing implementation prompt: `docs/pr/PR-CAM-SQUAT-SHALLOW-ARMING-CYCLE-TIMING-REALIGN-IMPLEMENTATION-PROMPT.md`
- Design prompt: `docs/pr/PR-CAM-SQUAT-SHALLOW-TEMPORAL-EPOCH-ORDER-REALIGN-DESIGN-PROMPT.md`

---

## 1. Problem Statement

**CURRENT_IMPLEMENTED**: Source #4 baseline sourcing is fixed, and the
structured pre-arming epoch handoff is now present. The representative shallow
fixtures can expose `pre_arming_kinematic_descent_epoch`, select it as
`selectedCanonicalDescentTimingEpochSource`, and reach `cycleDurationMs >= 800`
without threshold relaxation.

**CURRENT_IMPLEMENTED**: The old first blocker,
`minimum_cycle_timing_blocked`, is no longer the first blocker for the
representative shallow timing path. The arming/cycle-timing smoke proves the
earlier descent epoch is accepted and selected, while no E1 promotion condition
is implied.

**NOT_YET_IMPLEMENTED**: Canonical close can still stop at
`temporal_epoch_order_blocked`. The remaining issue is not source nullability,
not Source #4 activation, not baseline seeding, and not cycle-duration
visibility. The remaining issue is that the canonical close guard still receives
descent, peak, reversal, and recovery as loosely related timestamps rather than
as a single same-rep normalized epoch order.

**LOCKED_DIRECTION**: The next implementation must realign temporal epoch
ordering across pre-arming descent, peak, reversal, and recovery without
weakening authority. Completion-owner truth remains the only final pass opener.
Pass-core, bridge, event-cycle, closure-proof, and shallow assist remain
assist/veto/trace only.

---

## 2. Current Failure Map

The current path now has two distinct layers:

1. A **normalized descent timing selection** layer can accept the pre-arming
   descent epoch and compare it against local descent candidates using a
   valid-buffer coordinate.
2. The **canonical shallow close** layer still checks temporal order from four
   scalar timestamps:
   `descentStartAtMs`, `peakAtMs`, `reversalAtMs`, and
   `standingRecoveredAtMs`.

That scalar close guard currently requires:

```ts
descentStartAtMs != null &&
peakAtMs != null &&
reversalAtMs != null &&
standingRecoveredAtMs != null &&
peakAtMs > descentStartAtMs &&
reversalAtMs > peakAtMs &&
standingRecoveredAtMs > reversalAtMs
```

This is correct as a safety shape, but incomplete as an ownership model. It
does not know:

- whether `peakAtMs` was normalized from the same valid-buffer coordinate system
  as the selected pre-arming descent;
- whether the peak is the completion-slice peak or a stale/global artifact;
- whether reversal is a true post-peak epoch or merely a peak-time label;
- whether recovery is the current rep's standing recovery/finalize epoch or a
  stale tail;
- whether the four timestamps have one same-rep identity across the arming
  boundary.

So the current shallow path can be in this valid-but-blocked state:

- pre-arming descent epoch exists and is accepted;
- selected canonical descent timing epoch is earlier than slice-local source #4;
- cycle duration reaches the 800 ms floor;
- reversal and recovery evidence may be individually satisfied;
- canonical close still fails because the normalized ordering contract for
  `descent < peak < reversal < recovery` has not been fully established.

The problem is therefore **temporal epoch ordering**, not shallow detector
design.

---

## 3. Candidate Design Families

### A. Structured Normalized Epoch-Order Ledger - Preferred

Create one ordering ledger inside completion-core that carries every
ordering-critical epoch in the same coordinate system before canonical close is
derived.

Conceptual payload:

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

Why this ranks first:

- It solves the actual remaining problem: all close-critical epochs are ordered
  in one coordinate system, not mixed through scalar timestamps.
- It preserves the existing pre-arming descent handoff as a timing candidate
  only.
- It gives canonical close one authoritative temporal-order result after
  same-rep proof.
- It gives diagnostics enough structure to distinguish "timing visible" from
  "ordering legally closed".
- It does not relax thresholds, edit fixtures, mutate registry state, or revive
  pass-core as an opener.

### B. Peak / Reversal / Recovery Epoch Rebasing

Keep the current selected descent timing epoch machinery, but explicitly rebase
only the three downstream epochs:

- peak local index -> valid-buffer index;
- reversal local/derived timestamp -> valid-buffer index;
- standing recovery timestamp -> valid-buffer index.

Why this is secondary:

- It is smaller than Candidate A, but it can become a collection of one-off
  conversions without a single same-rep proof object.
- It fixes coordinate mismatch, but does not by itself define who owns ordering
  failure reasons.
- It risks preserving the current scalar close guard as the real owner while
  adding hidden conversion logic around it.

Candidate B may be the mechanical implementation technique under Candidate A,
but it should not be the design contract.

### C. Canonical Close Ordering Sub-Contract

Keep existing state fields, but define a dedicated sub-contract consumed by
canonical close:

```ts
canonicalTemporalOrder = {
  clear: boolean,
  blockedReason:
    | 'missing_descent_epoch'
    | 'missing_peak_epoch'
    | 'missing_reversal_epoch'
    | 'missing_recovery_epoch'
    | 'peak_not_after_descent'
    | 'reversal_not_after_peak'
    | 'recovery_not_after_reversal'
    | 'mixed_rep_epoch_contamination',
}
```

Why this is secondary:

- It makes close ownership clearer than today's scalar check.
- However, if it consumes unnormalized fields, it still depends on each caller
  to pre-clean the coordinate system.
- It is safest when backed by Candidate A's ledger; without the ledger it can
  become a named wrapper around the same ambiguity.

### Candidate Ranking

1. **A. Structured normalized epoch-order ledger** - preferred and binding
   direction.
2. **C. Canonical close ordering sub-contract** - useful as the consumer API of
   the ledger.
3. **B. Peak/reversal/recovery rebasing** - useful as implementation technique,
   but insufficient as the top-level design.

---

## 4. Preferred Design

The chosen direction is **Candidate A: structured normalized epoch-order
ledger**.

### 4.1 Canonical Inputs

The ledger must accept exactly these ordering-critical inputs:

- **descent epoch**: the selected canonical descent timing epoch, including
  `pre_arming_kinematic_descent_epoch` when accepted;
- **peak epoch**: the completion-core peak used for current-rep completion,
  rebased from slice-local index to valid-buffer index;
- **reversal epoch**: the authoritative rule/HMM reversal epoch, not
  provenance-only bridge text;
- **recovery epoch**: the current-rep standing recovery/finalize epoch used by
  completion-owner truth.

The ledger may also carry support-only context:

- completion slice start index;
- selected descent source;
- local index for debugging;
- timestamp;
- proof bits and blocked reason.

Support-only context may explain the ordering decision. It must not grant pass.

### 4.2 Coordinate System

The canonical coordinate system is the post-readiness **valid-buffer**.

Every ledger epoch must have:

- `validIndex`;
- `timestampMs`;
- `source`;
- optional `localIndex` if the epoch originated inside `completionFrames`;
- optional `frameRole` for diagnostics.

For local slice epochs:

```ts
validIndex = completionSliceStartIndex + localIndex
```

For timestamp-only epochs:

- first prefer an already-known frame index from the owner that produced the
  timestamp;
- otherwise map to the nearest valid-buffer frame with matching timestamp;
- if no unique valid-buffer frame can be found, the epoch is not proven and the
  ordering ledger must fail closed.

### 4.3 Peak Normalization

The peak epoch must be the peak currently owned by completion-core for the same
current rep.

It is legal only when:

- `peakLatched === true`;
- `peakLatchedAtIndex != null`;
- `completionSliceStartIndex` is known;
- normalized `peak.validIndex` is after the selected descent epoch;
- the peak is not at valid-buffer series start or completion-slice series start
  contamination.

If multiple peak-like values exist, the ledger must use the completion-owner
peak, not an arbitrary global peak or a pass-window assist peak.

### 4.4 Reversal Normalization

The reversal epoch must be a post-peak event epoch.

If current runtime stores reversal at the peak timestamp while separate evidence
says reversal was satisfied, the design does **not** permit weakening
`reversal > peak`. Instead, the future implementation must either:

- derive the first valid-buffer frame after the peak where rule/HMM reversal
  evidence becomes true; or
- fail closed with `reversal_not_after_peak`.

Bridge/proof-only signals may remain diagnostics. They may not create a reversal
epoch for ordering unless the gold-path rule/HMM reversal owner also confirms
the epoch.

### 4.5 Recovery Normalization

The recovery epoch must be the standing recovery/finalize epoch for the current
rep after reversal.

It is legal only when:

- `standingRecoveredAtMs != null`;
- standing finalize evidence is satisfied for the current rep;
- normalized `recovery.validIndex` is after normalized reversal;
- the recovery is not a stale tail paired with a prior reversal.

If recovery exists only as a broad suffix signal without a frame identity, the
future implementation must map it to the first valid-buffer frame that
established the finalize condition. If that cannot be proven, ordering must fail
closed.

### 4.6 Same-Rep Integrity

The ledger is valid only if all are true:

1. Baseline window precedes selected descent.
2. Selected descent precedes peak.
3. Peak precedes reversal.
4. Reversal precedes standing recovery.
5. All four epochs belong to the same post-readiness valid buffer.
6. No standing recovery/reset occurs between selected descent and peak.
7. Reversal-to-standing span remains within the current-rep ownership maximum.
8. Setup-motion block is not active.
9. No absurd-pass registry class is triggered.

If any proof bit is missing, ordering does not pass. The correct result is
`temporal_epoch_order_blocked`, with a more specific diagnostic reason if
available.

### 4.7 Where The Contract Runs

The ordering ledger should run in completion-core after:

- arming handoff has been validated;
- local descent candidates have been normalized;
- peak, reversal, and recovery evidence have been identified;
- completion-core has enough facts to build canonical shallow contract input.

Canonical close should then consume either:

- the ledger's ordered epoch timestamps; or
- a dedicated ledger result such as
  `canonicalTemporalEpochOrderSatisfied === true`.

The close layer must not recompute ordering from unrelated raw scalar fields.

### 4.8 How `temporal_epoch_order_blocked` Is Derived

After the change, `temporal_epoch_order_blocked` should mean:

> The normalized same-rep epoch ledger could not prove
> `descent < peak < reversal < recovery`.

It should not mean:

- an earlier descent source was missing;
- cycle duration was too short;
- Source #4 failed to fire;
- baseline was not seeded;
- pass-core did not open pass.

Recommended diagnostic breakdown:

- `missing_descent_epoch`;
- `missing_peak_epoch`;
- `missing_reversal_epoch`;
- `missing_recovery_epoch`;
- `peak_not_after_descent`;
- `reversal_not_after_peak`;
- `recovery_not_after_reversal`;
- `mixed_rep_epoch_contamination`;
- `stale_prior_rep_epoch`;
- `timestamp_not_mappable_to_valid_buffer`.

Canonical blocked reason may remain the public coarse value
`temporal_epoch_order_blocked`; diagnostics should carry the specific internal
reason.

---

## 5. Proof Obligations / Safety Constraints

The design must remain safe against:

1. **Standing still pass**: no descent ledger can form without a real selected
   descent epoch and downstream same-rep peak/reversal/recovery order.
2. **Setup-motion contaminated pass**: setup-motion remains a close blocker;
   ordering success cannot bypass it.
3. **No real descent**: pre-arming epoch still requires the frozen
   knee-angle descent predicate and same-rep proof.
4. **Contaminated early-peak false pass**: peak must be completion-owner peak,
   not a series-start or setup-motion artifact.
5. **Stale prior rep leakage**: all epoch indices must belong to one current
   valid buffer segment and pass current-rep ownership span.
6. **Mixed-rep timestamp contamination**: descent, peak, reversal, and recovery
   cannot be sourced from different rep identities.
7. **No real reversal**: reversal epoch must be rule/HMM owned, post-peak, and
   mappable to valid-buffer coordinates.
8. **No real recovery**: recovery must be a post-reversal current-rep
   standing/finalize epoch.
9. **Hidden split-brain**: `completionTruthPassed === false` must never yield
   final pass true through ordering success.

Thresholds remain frozen:

- no lowering `SHALLOW_OFFICIAL_CLOSE_MIN_CYCLE_MS`;
- no lowering `attemptAdmissionFloor`;
- no widening Source #4 bands;
- no fixture re-derivation;
- no fake `phaseHint` injection.

---

## 6. Split-Brain And Authority Guards

The ordering ledger must obey these guards:

1. **Completion-owner guard**: ledger success can only help canonical
   completion truth satisfy a close guard. It may not write
   `finalPassEligible`, `completionOwnerPassed`, or pass-core fields.
2. **Assist demotion guard**: pass-core, bridge, closure-proof, event-cycle, and
   shallow assist remain assist/veto/trace only.
3. **Pre-arming pairing guard**: a pre-arming descent from one rep cannot pair
   with a peak, reversal, or recovery from another rep. Any mismatch fails
   closed.
4. **Gold-path reversal guard**: bridge/proof-only reversal signals do not own
   reversal epoch ordering.
5. **Ordering-is-not-ownership guard**: `temporalOrderSatisfied === true` is
   not equivalent to `completionSatisfied === true`. It is one required close
   condition.
6. **Split-brain fail-close guard**: if ledger ordering and canonical shallow
   close disagree, the disagreement is diagnostic and must not be hidden by a
   pass-core fallback.

Forbidden states remain forbidden:

```ts
completionOwnerPassed !== true && finalPassEligible === true
completionTruthPassed === false && finalPassGranted === true
assistOnlyEvidence === true && finalPassEligible === true
```

---

## 7. Boundary / Ownership Spec

### Arming Layer

Owns:

- completion slice boundary;
- pre-arming baseline and descent epoch capture;
- valid-buffer indices for the pre-arming epoch;
- proof that pre-arming descent precedes the slice and peak guard.

Does not own:

- peak/reversal/recovery ordering;
- canonical close;
- final pass;
- registry state.

### Evaluator Handoff Layer

Owns:

- additive plumbing from arming to completion-state;
- exposing `completionSliceStartIndex`;
- preserving debug mirrors.

Does not own:

- temporal order judgment;
- completion truth writes;
- authority-law changes.

### Completion-Core Ordering Layer

Owns:

- the normalized epoch-order ledger;
- local-to-valid rebasing for peak/reversal/recovery;
- same-rep ordering proof;
- specific ordering reject reasons;
- feeding canonical close with ordered current-rep epochs.

Does not own:

- final pass surface;
- pass-core semantics;
- registry promotion.

### Canonical Close Layer

Owns:

- consuming the ordering ledger result;
- deriving `temporal_epoch_order_blocked` when the ledger cannot prove order;
- applying canonical shallow closure only after all close guards pass.

Does not own:

- recomputing unnormalized epoch ownership;
- using ordering success as independent pass ownership.

### Final Pass Surface

Owns:

- product pass visibility after completion-owner truth and allowed vetoes.

Does not own:

- interpreting temporal ordering as a direct opener;
- reading diagnostics as gate inputs.

### Debug / Diagnostics Layer

Owns:

- explaining which epochs were selected;
- explaining coordinate rebasing;
- explaining specific temporal order failure;
- supporting future E1 promotion evidence.

Does not own:

- pass/fail truth;
- authority-law decisions;
- proof-gate policy.

---

## 8. Coexistence With Current Diagnostics

Keep as-is:

- `seedBaselineKneeAngleAvg`: standing baseline seed, not an epoch owner.
- `legitimateKinematicShallowDescentOnsetFrameIndex`: useful Source #4
  diagnostic; document whether it is slice-local.
- `preArmingKinematicDescentEpoch*`: structured pre-arming timing candidate
  diagnostics.
- `selectedCanonicalDescentTimingEpoch*`: canonical descent timing decision.
- `effectiveDescentStartFrameSource`: readable selected source label.
- `descentAnchorCoherent`: existing descent-anchor coherence diagnostic.
- `normalizedDescentAnchorCoherent`: existing normalized descent candidate
  coherence diagnostic.
- `canonicalShallowContractDrovePass`: authority-law diagnostic only, never an
  opener.

Extend narrowly:

- add `canonicalTemporalEpochOrderSatisfied`;
- add `canonicalTemporalEpochOrderBlockedReason`;
- add `selectedCanonicalPeakEpochValidIndex/AtMs/Source`;
- add `selectedCanonicalReversalEpochValidIndex/AtMs/Source`;
- add `selectedCanonicalRecoveryEpochValidIndex/AtMs/Source`;
- add `temporalEpochOrderTrace` or equivalent compact trace.

Do not redesign:

- all shallow diagnostics;
- pass-core diagnostics;
- registry format;
- proof-gate skip markers;
- Source #4 detector fields.

Diagnostic goal:

- "timing visible but temporal order blocked" must be distinguishable from
  "timing source missing";
- "reversal evidence exists but no post-peak reversal epoch" must be explicit;
- "recovery exists but maps to stale/mixed rep" must be explicit.

---

## 9. Validation Plan

A future implementation must keep these current smokes green:

1. `scripts/camera-pr-cam-squat-shallow-authority-safe-descent-source-expansion-smoke.mjs`
2. `scripts/camera-pr-cam-squat-shallow-authority-safe-descent-source-followup-smoke.mjs`
3. `scripts/camera-pr-cam-squat-shallow-arming-cycle-timing-realign-smoke.mjs`
4. `scripts/camera-pr-01-squat-completion-first-authority-freeze-smoke.mjs`
5. `scripts/camera-pr-e1-shallow-lock-promotion-registry-smoke.mjs`
6. `scripts/camera-pr-f-regression-proof-gate.mjs`

The future branch also needs a new temporal-order replay smoke that proves, for
both `shallow_92deg` and `ultra_low_rom_92deg`:

- pre-arming descent epoch exists and remains accepted;
- selected descent timing epoch remains `pre_arming_kinematic_descent_epoch`;
- selected peak epoch is normalized into valid-buffer coordinates;
- selected reversal epoch is strictly after peak;
- selected recovery epoch is strictly after reversal;
- `canonicalTemporalEpochOrderSatisfied === true`;
- `canonicalShallowContractBlockedReason !== 'temporal_epoch_order_blocked'`;
- `completionTruthPassed === true` only if the full canonical close succeeds;
- final pass remains false unless completion-owner truth and UI/progression
  gates also allow it;
- no absurd-pass fixture flips to pass.

Illegal states that must stay locked:

- standing still;
- seated hold;
- setup-motion contaminated;
- no real descent;
- no real reversal;
- no real recovery;
- stale prior rep;
- mixed-rep timestamp contamination;
- contaminated early peak;
- `completionTruthPassed === false` plus final pass true.

Evidence required before `shallow_92deg` / `ultra_low_rom_92deg` can move to
`permanent_must_pass`:

- both fixtures satisfy the full canonical close;
- `completionTruthPassed === true`;
- `finalPassEligible === true`;
- `isFinalPassLatched('squat', gate) === true`;
- `canonicalShallowContractDrovePass === true`;
- PR-01 smoke remains green;
- absurd-pass smokes remain green;
- no threshold, fixture, authority-law, proof-gate, or skip-marker change was
  needed.

Until then, both fixtures remain `conditional_until_main_passes`.

---

## 10. Out Of Scope

The implementation branch that cites this SSOT must not do any of the following:

1. threshold relaxation;
2. pass-core opener revival;
3. fixture re-derivation or fixture edits;
4. fake `phaseHint` injection;
5. P4 registry promotion in the same session;
6. P3 registry normalization;
7. P2 naming/comment cleanup;
8. broad camera-stack rewrite;
9. Source #4 redesign;
10. proof-gate skip-marker expansion;
11. authority-law rewrite;
12. non-squat work.

---

## 11. Final Lock

The accepted design direction is a **structured normalized epoch-order
ledger**. The previous branch made canonical shallow timing able to see the
true same-rep pre-arming descent epoch. This branch must make peak, reversal,
and recovery participate in the same valid-buffer same-rep ordering contract
before canonical shallow close derives temporal legality.

The ledger may unblock `temporal_epoch_order_blocked` for legitimate shallow
reps, but it does not open final pass by itself. Completion-owner truth remains
the only final pass opener; quality remains separate; assist layers may explain
or veto, never grant.
