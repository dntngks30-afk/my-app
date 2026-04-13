# PR-CAM-SHALLOW-TEMPORAL-EPOCH-LOCK-01

> This document is the SSOT for restoring shallow squat pass behavior under a **single temporal epoch truth**. It is intentionally strict. Any implementation that conflicts with this document is wrong unless this document is explicitly superseded by a later SSOT.

## Objective

Restore the product law:

- **Meaningful shallow squat** with real **descent -> reversal/ascent -> standing recovery** must pass reliably.
- The following must **never** pass:
  - setup / camera placement motion
  - standing sway / idle standing
  - sitting down without recovery
  - already seated state
  - mid-ascent before full standing recovery
  - series-start contaminated peak
  - degenerate timing that fakes a rep without a real temporal cycle

This PR is not about making squat easier by loosening thresholds. It is about restoring the correct **temporal epoch ownership** for shallow reps.

## Scope

Allowed scope is limited to squat temporal truth and shallow pass gating.

Primary files expected:

- `src/lib/camera/squat-completion-state.ts`
- `src/lib/camera/squat/squat-progression-contract.ts`
- `src/lib/camera/auto-progression.ts`
- shallow/canonical squat files only when strictly required
- squat-focused smoke tests only

## Non-goals

- No threshold relaxation.
- No global timing number changes.
- No confidence threshold changes.
- No stable-frame-count changes.
- No overhead-reach / wall-angel / single-leg-balance changes.
- No UI copy / route / navigation / funnel changes.
- No broad refactor.
- No new pass writer.
- No reopening of removed completion-owner shallow reopen behavior.

## Root problem locked by this SSOT

The remaining shallow failure is **not** primarily a writer duplication problem anymore.

The root problem is:

- shallow observation / admission / bridge signals can become positive
- while the real temporal epoch is still incomplete or under-owned
- and while pass-core temporal truth still says there is no valid peak/reversal/recovery chain

That means shallow evidence can appear before the system truly owns:

- descent start time
- peak anchor timing
- reversal timing
- standing recovery timing

This PR must therefore lock a stricter rule:

> **No shallow pass-related closure signal may outrun temporal epoch truth.**

## Locked architecture law

### 1. Single writer law

Shallow/deep success must still be written by a single completion writer path.

- completion writer remains singular
- owner truth is reader-only
- UI gate is suppress-only
- observation / bridge / proof / event / candidate signals are never final pass owners

### 2. Temporal epoch law

A squat rep exists only if the system owns a real time-ordered cycle.

Minimum legal order:

1. readiness stable dwell satisfied
2. setup motion not blocked
3. attempt started after ready
4. descent start exists
5. peak exists and occurs after descent start
6. reversal exists and occurs after peak
7. standing recovery exists and occurs after reversal
8. standing recovery/finalize truth is satisfied
9. only then may ROM classification decide standard vs low_rom vs ultra_low_rom

### 3. ROM is classification, not ownership

`standard_cycle`, `low_rom_cycle`, `ultra_low_rom_cycle` are labels applied **after** temporal cycle truth exists.

They are not allowed to create pass truth by themselves.

### 4. Bridge/proof ceiling

The following are strictly **non-owner helper signals**:

- `officialShallowPathCandidate`
- `officialShallowPathAdmitted`
- `officialShallowStreamBridgeApplied`
- `officialShallowAscentEquivalentSatisfied`
- `officialShallowClosureProofSatisfied`
- any trajectory/event/provenance assist field

These may inform classification or diagnostics only after temporal truth is already valid.

They may not create or simulate a rep when pass-core temporal order is not yet valid.

## State legality rules

### Legal shallow success state

A shallow rep is legal only if all of the following are true:

- `readinessStableDwellSatisfied === true`
- `setupMotionBlocked === false`
- `attemptStartedAfterReady === true`
- `attemptStarted === true`
- `descendConfirmed === true`
- `descentStartAtMs != null`
- `peakLatched === true`
- `peakLatchedAtIndex > 0`
- `peakAtMs != null`
- `peakAtMs > descentStartAtMs`
- `reversalConfirmedAfterDescend === true`
- `reversalAtMs != null`
- `reversalAtMs > peakAtMs`
- `recoveryConfirmedAfterReversal === true`
- `standingRecoveredAtMs != null`
- `standingRecoveredAtMs > reversalAtMs`
- standing finalize / hold truth satisfied

Only after that may the rep be classified as `low_rom_cycle` or `ultra_low_rom_cycle`.

### Illegal state combinations

The following combinations are forbidden and must fail-close:

1. `descendConfirmed === true` but `descentStartAtMs == null`
2. `peakLatchedAtIndex <= 0`
3. `peakAtMs == null`
4. `reversalConfirmedAfterDescend === true` but `reversalAtMs == null`
5. `recoveryConfirmedAfterReversal === true` but `standingRecoveredAtMs == null`
6. `standingRecoveredAtMs <= reversalAtMs`
7. `officialShallowClosureProofSatisfied === true` while pass-core temporal truth is still blocked
8. `completionSatisfied === true` while pass-core says there is no valid peak/reversal/recovery chain
9. any state where setup/series-start contamination is still the active explanation for the candidate motion

## Hard fail-close signatures

These signatures must never pass.

### Setup / non-rep contamination

- setup phase camera movement
- standing sway
- idle standing
- sitting down without real recovery
- seated hold
- mid-ascent before standing recovered

### Series-start / anchor contamination

- `peak_anchor_at_series_start`
- `peakLatchedAtIndex <= 0`
- peak anchored to initial contaminated frames
- peak created before a real owned descent epoch

### Degenerate timing contamination

- no owned `descentStartAtMs`
- `peakAtMs` and commitment collapsed without a real peak-turn structure
- reversal that is only a helper/provenance artifact without real post-peak ownership
- helper/bridge proof becoming satisfied while pass-core still blocks on missing peak/reversal/recovery

## Pass-core precedence law

If pass-core temporal truth says the rep is not yet valid, shallow helper truth must not outrun it.

In practice this means:

- helper/proof signals can exist as diagnostics
- but they cannot elevate completion truth into pass
- and they cannot produce a state that looks like a legal closed shallow cycle while pass-core still blocks on missing peak/reversal/recovery

This PR should move the system toward this invariant:

> If `completionSatisfied === true`, then pass-core temporal truth must already agree that a valid descent -> peak -> reversal -> standing recovery cycle exists.

## Design intent for implementation

Implementation should focus on **temporal epoch locking**, not threshold loosening.

### Required direction

1. Shallow path must not advance beyond temporal truth.
2. `descentStartAtMs` must become part of shallow legality, not optional debug.
3. Peak legality must require post-descent ownership.
4. Reversal legality must require post-peak ordering.
5. Recovery legality must require standing-recovered ordering.
6. ROM classification must be downstream of the above, not upstream.

### Explicitly disallowed direction

- allowing shallow closure because candidate/admission/proof “looks good enough”
- reopening pass via owner-local override
- using UI vetoes as the primary protection layer
- masking illegal temporal states with event/provenance/trajectory helpers

## Acceptance tests

### A. Legit shallow pass

Must pass:

- meaningful shallow down-up-recover rep
- meaningful ultra-low but still legal down-up-recover rep, if it satisfies existing policy

### B. Legit deep pass preserved

Must still pass:

- standard deep squat -> `standard_cycle`

### C. False-pass zero tolerance

Must fail:

- setup motion
- standing sway
- seated state
- sitting down only
- mid-ascent before standing recovered
- series-start contaminated peak
- degenerate timing pseudo-cycle

### D. Illegal split-brain blocked

Must fail-close if any helper/proof/closure state claims shallow closure while pass-core temporal truth still blocks due to missing owned cycle.

## Suggested verification matrix

Run or add squat-only smoke coverage for:

- legit shallow down-up-recover pass
- legit deep pass preserved
- series-start contamination fail-close
- no early pass guarantee
- owner read boundary
- UI gate boundary
- owner contradiction invariant
- split-brain illegal state fail-close

## Absolute prohibitions for the implementation PR

- Do not change thresholds.
- Do not add a new success writer.
- Do not reintroduce shallow reopen logic.
- Do not convert helper/proof signals into owners.
- Do not rely only on final UI veto.
- Do not touch non-squat camera steps.

## Completion condition for this PR

This PR is complete only when:

1. legal shallow reps pass through the same temporal epoch law as deep reps
2. ROM classification happens only after valid temporal truth exists
3. false-pass signatures listed above fail-close
4. no helper/proof state can outrun pass-core temporal truth
5. deep standard path remains intact

## Implementation note

Any implementation generated from this document must read this file first and restate the locked truths before code changes. Skipping the read step is non-compliant.
