# PR-CAM-SQUAT-SHALLOW-ARMING-CYCLE-TIMING-REALIGN — Design SSOT

> **Session type**: docs-only design SSOT.
>
> **Scope lock**: no `src/*`, no `scripts/*`, no threshold, no fixture, no
> authority-law, no proof-gate, no registry, no P2/P3/P4 work. This document
> is the sole intended output of this session.
>
> **Decision**: prefer **structured arming epoch handoff**. The next
> implementation branch should carry an authority-safe pre-arming kinematic
> descent epoch into completion-state so canonical shallow cycle timing can
> reference the true same-rep descent start, without widening who may open
> final pass.

## References

- Parent squat SSOT: `docs/SSOT_SQUAT_COMPLETION_FIRST_QUALITY_STRICT_2026_04.md`
- Truth map: `docs/pr/PR-SQUAT-COMPLETION-FIRST-QUALITY-STRICT-TRUTH-MAP-01.md`
- Authority freeze: `docs/pr/PR-01-SQUAT-COMPLETION-FIRST-AUTHORITY-FREEZE.md`
- Source #4 design: `docs/pr/PR-CAM-SQUAT-SHALLOW-AUTHORITY-SAFE-DESCENT-SOURCE-EXPANSION.md`
- Promotion blocked report: `docs/pr/PR-E1-P4-SHALLOW-PROMOTION-BLOCKED-REPORT.md`
- Source #4 follow-up fix report: `docs/pr/PR-CAM-SQUAT-SHALLOW-AUTHORITY-SAFE-DESCENT-SOURCE-FOLLOWUP-FIX-REPORT.md`
- Design prompt: `docs/pr/PR-CAM-SQUAT-SHALLOW-ARMING-CYCLE-TIMING-REALIGN-DESIGN-PROMPT.md`

---

## 1. Problem Statement

**CURRENT_IMPLEMENTED**: Source #4 now fires on the representative shallow
fixtures for the right reason. The baseline knee-angle seed restores the true
standing `kneeAngleAvg` median, and
`legitimateKinematicShallowDescentOnsetFrameIndex` is non-null through the
gate path.

**CURRENT_IMPLEMENTED**: Promotion is still blocked because Source #4 fires at
slice-local index `0`, tied with `trajectoryDescentStartFrame`. The selected
`effectiveDescentStartFrame` cannot move earlier than the first frame in
`completionFrames`.

**LOCKED_DIRECTION**: The remaining blocker is therefore not Source #4
nullability. It is the arming/cycle-timing boundary: the completion slice can
begin mid-descent, while canonical shallow cycle timing still needs the
earlier same-rep descent epoch to satisfy the 800 ms floor.

The narrow question for the next implementation branch is:

**How should earlier standing/descent timing truth cross the arming boundary
so legitimate shallow reps can satisfy canonical cycle timing without
threshold relaxation, fixture edits, pass-core opener revival, or
authority-law drift?**

---

## 2. Current Failure Map

The current gate path has this shape:

1. `evaluateSquatFromPoseFrames` builds `valid` frames after readiness dwell.
2. `computeSquatCompletionArming(valid)` returns `completionFrames`.
3. On the representative shallow fixtures, `completionSliceStartIndex = 16`.
4. The first completion-slice frame is already mid-descent
   (`kneeAngleAvg` around `97.8deg`).
5. `evaluateSquatCompletionState(completionFrames, ...)` evaluates local
   slice indices only.
6. Source #4 now uses true standing `seedBaselineKneeAngleAvg`, so it fires,
   but its earliest searchable local frame is still slice index `0`.
7. Source #2 and Source #4 therefore tie at local index `0`.
8. `cycleDurationMs = standingRecoveredAtMs - effectiveDescentStartFrame.timestampMs`
   is still measured from too late in the motion.
9. The canonical shallow contract remains blocked with
   `minimum_cycle_timing_blocked`.

This is a structural truncation issue. Fixing Source #4 baseline sourcing
made the detector truthful, but it did not make the completion slice contain
the earlier true descent onset.

---

## 3. Candidate Design Families

### A. Structured Arming Epoch Handoff (Preferred)

Carry a proof-bearing pre-arming timing epoch from the full `valid` buffer into
completion-state. The epoch represents the true same-rep standing baseline and
first kinematic descent onset, even when `completionFrames` starts later.

Conceptual payload:

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

Why this ranks first:

- It preserves the current completion slice for completion truth.
- It adds timing truth as a structured handoff, not as a bare magic
  timestamp.
- It makes same-rep integrity auditable.
- It does not make arming, Source #4, pass-core, bridge, or event-cycle a
  final pass opener.
- It solves the actual problem: local slice index `0` cannot represent an
  earlier frame that was truncated out of the slice.

### B. Bare Pre-Arming `descentStartAtMs` Seed

Pass only an additive scalar such as `seedDescentStartAtMs` into
completion-core and use it for `cycleDurationMs`.

Why this is secondary:

- It is mechanically small, but too easy to misuse.
- A scalar alone does not explain which baseline window, onset frame, slice
  boundary, or peak it belongs to.
- It increases stale-prior-rep and mixed-rep risk unless surrounded by the same
  proof payload Candidate A already requires.

This may be the implementation form after Candidate A's payload is reduced,
but it must not be the design contract.

### C. Dual-Window Canonical Timing Model

Keep `completionFrames` for completion logic, but define a separate timing
window over full `valid` frames. The canonical contract reads timing from the
timing window and completion evidence from the completion slice.

Why this is secondary:

- It cleanly names the two concerns, but risks creating a second canonical
  owner if not tightly constrained.
- It is broader than needed because the only missing datum is the earlier
  descent epoch.
- It would require heavier split-brain accounting between the timing window
  and completion slice.

Candidate C may become useful if future real-capture replay proves multiple
pre-slice timing facts are needed. For this branch, it is more surface area
than the current blocker requires.

---

## 4. Preferred Design

The next branch should implement **Candidate A: structured arming epoch
handoff**.

### 4.1 What Earlier Truth Is Handed Off

The handoff should carry:

- the standing baseline knee-angle median used to prove true standing;
- the valid-buffer baseline window indices;
- the first valid-buffer frame where kinematic descent onset is proven;
- the onset timestamp;
- the onset knee angle;
- the completion slice start index;
- a same-rep peak guard index/timestamp;
- proof bits showing monotonic sustain and no intervening recovery reset.

This handoff is not a new detector family. It is Source #4's timing truth
lifted from the full valid-buffer coordinate system instead of being trapped
inside the post-arming local slice.

### 4.2 Where It Is Sourced From

Source it at the evaluator/arming boundary, where both coordinate systems are
visible:

- `valid`: the full post-readiness buffer;
- `completionArming.completionSliceStartIndex`: the slice boundary;
- `completionFrames`: the post-arming local slice;
- true standing `kneeAngleAvg` baseline samples;
- global/valid-buffer timestamps.

The source must prefer the same kinematic predicates already approved for
Source #4:

- baseline is true standing;
- onset is `kneeAngleAvg <= baseline - 5.0deg`;
- sustain is monotonic non-increase for the frozen 2-frame rule;
- onset is before the same-rep peak;
- attempt admission and recovery/reversal remain downstream gates.

### 4.3 How It Crosses the Arming Boundary

The evaluator passes the structured epoch as an additive option into
`evaluateSquatCompletionState`. Completion-state passes it into
completion-core. Completion-core may consume it only as a candidate for the
canonical descent timing epoch.

The handoff must not:

- set `attemptStarted`;
- set `descendConfirmed` by itself;
- set reversal or recovery truth;
- set `completionSatisfied`;
- write `completionOwner*`;
- open `finalPassEligible`;
- mutate pass-core output.

### 4.4 Canonical Inputs vs Sink-Only Observability

Canonical timing inputs after the redesign:

- `preArmingKinematicDescentEpoch.descentOnsetAtMs`, after same-rep proof;
- the normalized selected descent timing epoch;
- `descendStartAtMs`, if derived from that selected epoch;
- `cycleDurationMs`, derived from selected epoch to standing recovery;
- canonical shallow contract input built from those fields.

Sink-only or diagnostic fields:

- existing `legitimateKinematicShallowDescentOnsetFrameIndex` when it remains
  slice-local;
- existing `legitimateKinematicShallowDescentOnsetAtMs` unless explicitly
  replaced by a normalized epoch field;
- `effectiveDescentStartFrameSource` as a debug label;
- new debug fields such as
  `preArmingKinematicDescentEpochValidIndex`,
  `preArmingKinematicDescentEpochAtMs`,
  `preArmingTimingEpochAccepted`, and
  `preArmingTimingEpochRejectedReason`;
- `canonicalShallowContractDrovePass`, which remains proof/diagnostic of
  realized canonical pass, not a pass opener.

`descentAnchorCoherent` stays a guard/diagnostic bridge. It should be extended
to compare the selected normalized timing epoch against all available local
and pre-arming candidates in one coordinate system.

### 4.5 Same-Rep Integrity

The epoch is eligible only if all of the following are true:

1. The baseline window precedes the onset.
2. The onset precedes the completion-slice peak used by completion-core.
3. The onset belongs to the same `valid` buffer after readiness dwell.
4. The onset is not from a prior completed rep.
5. No standing recovery reset occurs between onset and the completion slice.
6. The completion slice still contains reversal/recovery evidence for the same
   rep.
7. The selected peak, reversal, and standing recovery remain ordered:
   `descentStartAtMs < peakAtMs < reversalAtMs < standingRecoveredAtMs`.

If any same-rep proof bit is missing, the handoff must be ignored and the
current local-slice behavior must fail closed.

### 4.6 How `cycleDurationMs` Is Derived

After the redesign:

```ts
selectedDescentTimingEpoch =
  earliest accepted candidate by normalized valid-buffer index or timestamp:
    - phase_hint_descent
    - trajectory_descent_start
    - shared_descent_epoch
    - legitimate_kinematic_shallow_descent_onset
    - pre_arming_kinematic_descent_epoch

cycleDurationMs =
  standingRecoveredAtMs - selectedDescentTimingEpoch.timestampMs
```

The selected epoch may be pre-slice. That is legal only for timing. Reversal,
recovery, closure, final pass, and quality still come from completion-owner
truth plus allowed vetoes.

---

## 5. Proof Obligations / Safety Constraints

The future implementation must remain safe against:

1. **Standing-still pass**: no onset if knee angle does not drop below the
   frozen baseline by the existing 5.0deg rule with sustain.
2. **Setup-motion contaminated pass**: setup-motion blocks remain vetoes; the
   epoch cannot override them.
3. **No real descent**: the epoch requires sustained kinematic descent and
   downstream descent/reversal/recovery gates.
4. **Contaminated early-peak false pass**: pre-arming onset cannot select a
   peak from setup or blend contamination; the same-rep peak guard must bind.
5. **Stale prior rep leakage**: an onset before a prior recovery reset cannot
   be paired with a later standing recovery.
6. **Mixed-rep timestamp contamination**: descent, peak, reversal, and recovery
   must be ordered within one rep identity.
7. **No real reversal / no recovery**: the epoch provides descent timing only;
   canonical reversal and recovery evidence must still pass.
8. **Hidden split-brain**: `completionTruthPassed === false` must not become
   final pass true through the epoch.

Thresholds remain frozen. In particular:

- do not lower `SHALLOW_OFFICIAL_CLOSE_MIN_CYCLE_MS`;
- do not lower `attemptAdmissionFloor`;
- do not change `KNEE_DESCENT_ONSET_EPSILON_DEG`;
- do not change `KNEE_DESCENT_ONSET_SUSTAIN_FRAMES`;
- do not widen Source #4 bands.

---

## 6. Split-Brain and Authority Guards

The new handoff avoids authority drift by obeying these guards:

1. **Completion-owner guard**: the epoch may feed only
   `descendStartAtMs` / `cycleDurationMs` / canonical shallow contract timing.
   It may not write completion pass fields directly.
2. **Assist-only guard**: pass-core, bridge, closure-proof, event-cycle, and
   shallow assist remain assist/veto/trace layers. None may become an opener
   because the pre-arming epoch exists.
3. **Same-rep guard**: the epoch must carry valid-buffer coordinates and must
   be rejected if it cannot be ordered against the slice peak, reversal, and
   standing recovery.
4. **Normalized-anchor guard**: local slice indices and pre-arming indices must
   be compared in a normalized coordinate system. Comparing local index `0`
   against pre-slice onset is invalid.
5. **Fail-close guard**: if normalized anchor coherence is false or unknown,
   canonical shallow contract must stay blocked.
6. **Pass-core drift guard**: the handoff must not change
   `completionOwnerReason`, `squatPassCore.passDetected`, or final pass
   authority semantics.

Forbidden state remains forbidden:

```ts
completionTruthPassed === false && finalPassGranted === true
```

The epoch can help canonical completion truth become true. It cannot make final
pass true while completion truth remains false.

---

## 7. Boundary / Ownership Spec

### Arming Layer

Owns:

- selecting the completion slice boundary;
- exposing the standing baseline window used for arming;
- producing optional pre-arming timing epoch metadata when it can prove the
  epoch belongs to the same current rep.

Does not own:

- final pass;
- completion truth;
- reversal/recovery truth;
- registry promotion.

### Completion-Core Layer

Owns:

- normalizing local and pre-arming descent candidates into one timing-epoch
  coordinate system;
- deriving `descendStartAtMs` and `cycleDurationMs`;
- preserving existing completion truth gates;
- rejecting incoherent or stale epochs.

Does not own:

- P4 promotion;
- threshold changes;
- pass-core opener semantics.

### Evaluator Handoff Layer

Owns:

- plumbing the arming epoch option from `valid`/arming into completion-state;
- preserving the current pass-window and pass-core sequencing;
- packaging additive diagnostics.

Does not own:

- direct completion truth writes;
- final pass authority.

### Final Pass Surface

Owns:

- product pass visibility only after completion-owner truth and allowed vetoes.

Does not own:

- interpreting pre-arming epoch as an independent pass grant.

### Debug / Diagnostics Layer

Owns:

- explaining which epoch source won;
- explaining whether the pre-arming epoch was accepted or rejected;
- surfacing normalized anchor coherence;
- supporting future promotion evidence.

Does not own:

- pass/fail truth.

---

## 8. Coexistence With Current Diagnostics

Keep:

- `seedBaselineKneeAngleAvg`: remains the true standing baseline knee-angle
  seed; do not reinterpret it as a descent epoch.
- `legitimateKinematicShallowDescentOnsetFrameIndex`: remains useful for
  local Source #4 firing. If it stays slice-local, document it as such.
- `effectiveDescentStartFrameSource`: remains a readable source label, but
  should gain a new value such as `pre_arming_kinematic_descent_epoch`.
- `descentAnchorCoherent`: remains the split-brain/coherence guard.
- `canonicalShallowContractDrovePass`: remains proof that final pass was
  driven by canonical completion truth.

Extend narrowly:

- add normalized/global valid-buffer index diagnostics for the pre-arming
  epoch;
- add accept/reject reason for the handoff;
- add a clear distinction between local slice onset and canonical timing
  epoch if they differ.

Do not redesign:

- all shallow diagnostics;
- pass-core diagnostics;
- registry format;
- proof-gate skip markers.

The diagnostic goal is to make the next failure obvious:

- Source #4 fired but stayed local-only;
- pre-arming epoch was absent;
- pre-arming epoch was rejected for stale/mixed/coherence reasons;
- pre-arming epoch was accepted but another canonical gate still blocked.

---

## 9. Validation Plan

Before E1 promotion is revisited, a future implementation must prove:

1. Existing source-expansion smoke remains green.
2. Source #4 follow-up smoke remains green.
3. PR-01 authority-freeze smoke remains green.
4. E1 shallow lock-promotion smoke remains green without registry mutation in
   the implementation branch unless all canonical promotion bits truly pass.
5. PR-F proof gate remains green with no new skip markers.
6. A new arming/cycle-timing replay smoke proves, for both
   `shallow_92deg` and `ultra_low_rom_92deg`:
   - Source #4 still fires;
   - pre-arming epoch is accepted;
   - selected canonical descent timing epoch is earlier than slice-local `0`;
   - `cycleDurationMs >= 800`;
   - `canonicalShallowContractBlockedReason` is no longer
     `minimum_cycle_timing_blocked`;
   - `completionTruthPassed === true`;
   - `finalPassEligible === true`;
   - `canonicalShallowContractDrovePass === true`;
   - no absurd-pass fixture flips to pass.
7. Illegal state replay remains locked for:
   - standing still;
   - seated hold;
   - setup-motion contaminated;
   - no real descent;
   - no real reversal;
   - no real recovery;
   - stale prior rep;
   - mixed-rep timestamp contamination;
   - contaminated early peak.

Evidence that would justify moving `shallow_92deg` and
`ultra_low_rom_92deg` to `permanent_must_pass`:

- both fixtures pass all canonical bits above;
- the registry smoke can remove conditional handling without weakening
  assertions;
- PR-01 and absurd-pass smokes remain green;
- no threshold, fixture, authority, or proof-gate edits are required to make
  them pass.

**Current main:** the promotion path described in companion SSOT completed; both representatives are **`permanent_must_pass`** with full canonical proof. **SSOT:** `docs/pr/PR-E1-shallow-representative-must-pass-landed-status-lock.md`. The checklist above is retained as historical evidence framing, not a pending conditional registry statement.

---

## 10. Out Of Scope

The next implementation branch that cites this SSOT must not do any of the
following:

1. threshold relaxation;
2. pass-core opener revival;
3. fixture re-derivation or fixture edits;
4. fake `phaseHint` injection;
5. Source #4 band widening;
6. authority-law rewrite;
7. P4 registry promotion in the same session unless the prompt explicitly
   authorizes it and every canonical bit is green;
8. P3 registry normalization;
9. P2 naming/comment cleanup;
10. PR-F skip-marker expansion;
11. broad camera-stack rewrite;
12. non-squat work.

---

## 11. Final Lock

The accepted design direction is **structured arming epoch handoff**:
carry a proof-bearing pre-arming kinematic descent epoch from the full
post-readiness `valid` buffer into completion-core, normalize it with local
descent candidates, and allow canonical shallow cycle timing to derive
`cycleDurationMs` from that same-rep earlier epoch.

This solves the real blocker left after Source #4 activation: the current
completion slice starts mid-descent, so no local source can move earlier than
slice index `0`. The handoff may make canonical completion truth reachable,
but it does not open final pass by itself and does not relax any threshold,
fixture, proof gate, registry state, or authority law.
