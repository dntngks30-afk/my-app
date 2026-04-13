# PR-CAM-ULTRA-SHALLOW-EPOCH-OWNER-01

> This document is the SSOT for restoring **legitimate ultra-shallow / shallow real-user squat pass** without reopening false-pass regressions.
> 
> Any implementation that conflicts with this document is wrong unless this document is explicitly superseded by a later SSOT.

## Objective

Restore the product law for real-user shallow squats:

- A real shallow rep with meaningful **descent -> reversal/ascent -> standing recovery** must pass.
- The following must still **never** pass:
  - setup / camera placement motion
  - standing sway / idle standing
  - sitting down without real recovery
  - already seated state
  - mid-ascent before standing recovery
  - series-start contaminated peak
  - degenerate pseudo-cycle with no owned descent epoch

This PR is **not** a threshold-loosening PR.
This PR is an **epoch ownership restoration PR**.

## Why this PR exists

The previous temporal-epoch lock closed false-pass paths, but real-device shallow reps are still failing.

The locked diagnosis is:

1. Real-device failing shallow reps are frequently in the **ultra_low_rom** band, not the low_rom band.
2. Newly added low-rom salvage paths do not cover those real-device ultra-low cases.
3. Existing structural shallow promotion paths require rescue/provenance conditions that are not present in the failing real-device logs.
4. The real blocker is earlier and more fundamental:
   - pass-core continues to show `descentDetected=true`
   - while `descentStartAtMs` remains null
   - and therefore the system never truly owns a legal rep epoch.

This means the system is observing motion, but is not owning it as a legal current rep.

## Locked root cause

The root cause is **not** that helper/proof signals are too weak.
The root cause is that **legitimate ultra-shallow reps still do not receive a legal owned epoch in pass-core/current-rep truth**.

In failing logs, the system often reaches some combination of:

- `attemptStarted = true`
- `descendConfirmed = true`
- `officialShallowPathAdmitted = true`
- `officialShallowStreamBridgeApplied = true`
- `officialShallowClosureProofSatisfied = true`
- `reversalConfirmedAfterDescend = true`
- `recoveryConfirmedAfterReversal = true`

while still failing because:

- `descentStartAtMs == null`, or
- `passBlockedReason = no_reversal_after_peak`, or
- `passBlockedReason = reversal_span_too_short`, or
- `completionBlockedReason = descent_span_too_short / ascent_recovery_span_too_short`

That means the system still lacks a valid **owner-grade current-rep epoch**, even when helper/proof signals later become positive.

## Core product law

### 1. Epoch first, ROM later

A squat rep is legal only after the system owns a valid temporal cycle:

1. readiness stable dwell satisfied
2. setup motion not blocked
3. attempt started after ready
4. descent start exists
5. peak exists and occurs after descent start
6. reversal exists and occurs after peak
7. standing recovery exists and occurs after reversal
8. finalize/standing recovery truth is satisfied
9. only then may ROM classification assign `standard_cycle`, `low_rom_cycle`, or `ultra_low_rom_cycle`

### 2. Ultra-low is still a real rep if the epoch is real

Ultra-low ROM is not automatically invalid.

If the system can prove a real current rep with:
- legal descent start
- legal peak
- legal reversal
- legal standing recovery
- and no contamination

then ultra-low may pass under the existing product policy.

### 3. Helper/proof never outruns owner truth

The following are support-only and never final owners:

- `officialShallowPathCandidate`
- `officialShallowPathAdmitted`
- `officialShallowStreamBridgeApplied`
- `officialShallowAscentEquivalentSatisfied`
- `officialShallowClosureProofSatisfied`
- trajectory / provenance / fallback / bridge signals

They may annotate or support a rep **after** a legal epoch exists.
They may not create the epoch.

## Locked diagnosis from current failure pattern

### A. Ultra-low gap

Current real-device failures live in ultra-low shallow territory.
A salvage path that starts only at `0.07 <= relativeDepthPeak < 0.4` cannot restore those real-device reps.

### B. Rescue dependency mismatch

A salvage path that requires `trajectoryReversalRescueApplied === true` will not help if the failing real-device logs do not actually set that flag.

### C. Missing owned descent start

The most important failure is this:

> `descendConfirmed === true` while `descentStartAtMs == null`

This is a forbidden half-state.
It means the system is willing to say “some descent-like motion was seen,” but cannot say “the current rep legally started here.”

As long as this remains unresolved, helper/proof signals cannot legitimately close the rep.

## Single-writer law remains locked

- success writer remains singular
- owner truth remains reader-only
- UI gate remains suppress-only
- this PR must not add a new success writer
- this PR must not reintroduce reopen behavior

This PR must restore a valid **input epoch** to the existing writer path, not create an alternate writer.

## Scope

Allowed scope is limited to squat epoch ownership for ultra-shallow / shallow real-device pass restoration.

Primary files expected:

- `src/lib/camera/squat-completion-state.ts`
- `src/lib/camera/auto-progression.ts`
- `src/lib/camera/squat/shallow-completion-contract.ts`
- `src/lib/camera/squat/squat-completion-canonical.ts`
- `src/lib/camera/evaluators/squat-low-rom-angle-rule.ts` only if needed to remove invalid assumptions
- `src/lib/camera/evaluators/squat-shallow-structural-owner.ts` only if needed to align with real logs
- squat-only smoke tests

## Non-goals

- No threshold relaxation.
- No global timing number changes.
- No confidence threshold changes.
- No stable-frame-count changes.
- No overhead-reach / wall-angel / single-leg-balance changes.
- No route / UI / funnel changes.
- No broad refactor.
- No new writer.
- No helper/proof ownership escalation.

## Locked architecture direction

### 1. A legal ultra-shallow owner path must exist

The system must have an owner-grade path for **real ultra-low shallow reps** that:

- does not depend on trajectory rescue being true
- does not depend on helper/proof being promoted into ownership
- does not bypass pass-core timing truth
- does not reopen false-pass regressions

### 2. `descentStartAtMs` is now a hard epoch requirement

For shallow/ultra-shallow legal pass:

- `descentStartAtMs != null` is mandatory
- `peakAtMs > descentStartAtMs` is mandatory
- `reversalAtMs > peakAtMs` is mandatory
- `standingRecoveredAtMs > reversalAtMs` is mandatory

If any of these fail, pass is blocked.

### 3. Forbidden illegal combinations

These states are illegal and must fail-close:

1. `descendConfirmed === true` and `descentStartAtMs == null`
2. `officialShallowClosureProofSatisfied === true` while pass-core still lacks owned descent/peak/reversal/recovery
3. `reversalConfirmedAfterDescend === true` while `reversalAtMs == null`
4. `recoveryConfirmedAfterReversal === true` while `standingRecoveredAtMs == null`
5. `peakLatchedAtIndex <= 0`
6. `peakAtMs <= descentStartAtMs`
7. `reversalAtMs <= peakAtMs`
8. `standingRecoveredAtMs <= reversalAtMs`

### 4. Real-device ultra-low coverage requirement

Any salvage / ownership restoration path introduced by this PR must cover real-device cases in the band:

- `LEGACY_ATTEMPT_FLOOR <= relativeDepthPeak < LOW_ROM_LABEL_FLOOR`

if and only if a legal epoch exists.

That means:
- ultra-low real reps may pass
- ultra-low fake reps must still fail

## Hard fail-close signatures remain locked

Must never pass:

- setup motion
- standing sway
- seated hold
- sitting-down only
- mid-ascent before standing recovered
- series-start contamination
- peak at index 0
- degenerate pseudo-cycle with no owned descent epoch
- bridge/proof-only closure without pass-core-owned rep

## Implementation intent

This PR should **repair owner input truth**, not loosen policy.

### Required direction

1. Identify why current shallow/ultra-shallow real reps still fail to produce `descentStartAtMs`.
2. Restore a legal current-rep descent epoch for those real reps.
3. Ensure that ultra-low real reps can travel through the same single-writer pass path.
4. Remove assumptions in rescue/promote wrappers that do not match real-device logs.
5. Keep helper/proof signals downstream of epoch truth.

### Explicitly disallowed direction

- passing because helper/proof looks convincing
- promoting trajectory/proof/support fields into owner truth
- adding a second success writer
- solving by numeric threshold loosening
- broadening all shallow paths indiscriminately

## Acceptance tests

### A. Legit ultra-shallow pass

Must pass:

- real ultra-low shallow down-up-recover rep with legal epoch ownership

### B. Legit shallow pass

Must pass:

- real shallow down-up-recover rep with legal epoch ownership

### C. Deep standard preserved

Must still pass:

- standard deep squat -> `standard_cycle`

### D. False-pass zero tolerance

Must fail:

- setup motion
- standing sway
- seated state
- sitting down only
- mid-ascent
- series-start contaminated peak
- degenerate timing pseudo-cycle

### E. Illegal half-state blocked

Must fail-close when:

- `descendConfirmed === true` but `descentStartAtMs == null`
- helper/proof positive but pass-core epoch still illegal

## Suggested verification matrix

Run or add squat-only smoke coverage for:

- real ultra-shallow legal epoch pass
- real shallow legal epoch pass
- deep standard preserved
- setup contamination fail-close
- series-start contamination fail-close
- no early pass guarantee
- owner contradiction invariant
- helper-positive / epoch-null illegal-state fail-close

## Absolute prohibitions for the implementation PR

- Do not change thresholds.
- Do not add a new success writer.
- Do not reintroduce reopen logic.
- Do not treat helper/proof as owner truth.
- Do not touch non-squat camera steps.
- Do not “pass by exception” without legal epoch ownership.

## Completion condition for this PR

This PR is complete only when:

1. real ultra-low shallow reps can pass through a legal owned epoch
2. `descentStartAtMs` is no longer missing for the legitimate reps this PR targets
3. helper/proof signals remain downstream of owner truth
4. false-pass signatures remain blocked
5. deep standard path remains intact

## Implementation note

Any implementation generated from this document must read this file first and restate the locked truths before code changes. Skipping the read step is non-compliant.
