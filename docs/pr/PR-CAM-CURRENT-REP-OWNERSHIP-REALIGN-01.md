# PR-CAM-CURRENT-REP-OWNERSHIP-REALIGN-01

> This document is the SSOT for realigning **current-rep ownership** in squat pass truth.
>
> It is intentionally narrow. This is not a threshold-tuning PR and not a broad evaluator rewrite. This PR exists because the runtime is still failing to carry a legitimate shallow / ultra-shallow rep through a single owned current-rep timeline.

## Why this PR exists

Current live runtime shows a repeated structural pattern:

- the user performs a real shallow / ultra-shallow down-up motion
- readiness is already satisfied
- shallow observation signals appear
- later helper/proof signals may also appear
- but the runtime does not preserve one coherent current rep from arming -> descent -> peak -> reversal -> recovery -> standing

The result is repeated fail-close with combinations such as:

- `attemptStarted=false` near committed-bottom even though shallow motion is already visible
- `baselineFrozen=false`, `peakLatched=false`, `peakLatchedAtIndex=0/1`
- `descentDetected=true` while `passCore.descentStartAtMs==null`
- completion timestamps and pass-core timestamps diverging across what should be the same rep
- helper/proof positive while the final owner chain still blocks

This is a **current-rep ownership fracture** problem.

## Locked diagnosis

### 1. Setup is not the main blocker

Readiness and setup are already mostly satisfied in the failing live traces.
This PR must not chase setup/UI explanations.

### 2. The main failure is earlier than canonical closure

Canonical shallow closure is already strict.
The real issue is that the runtime fails to maintain a single owned rep timeline before canonical close is even possible.

### 3. The failure is multi-layered, not a single threshold

The live truth map shows these coupled failures:

1. attempt ownership opens too late
2. baseline freeze / peak latch ownership fails or lags
3. pass-core never owns `descentStartAtMs`
4. reversal may appear in helper/rule space but not as owner-grade pass-core truth
5. completion and pass-core may refer to different rep/timebases
6. support/helper layers become positive before owner truth is coherent

This PR must treat these as one ownership pipeline problem.

## Objective

Realign the squat runtime so that a legitimate shallow / ultra-shallow rep can travel through **one coherent current rep**:

1. readiness / armed
2. attempt started
3. descent epoch opened
4. baseline frozen / peak latch owned
5. peak owned
6. reversal owned
7. standing recovery owned
8. canonical close allowed

This PR must do that **without** reopening false-pass regressions.

## Scope

Primary expected files:

- `src/lib/camera/squat/squat-completion-core.ts`
- `src/lib/camera/squat-completion-state.ts`
- `src/lib/camera/squat/squat-completion-canonical.ts`
- `src/lib/camera/auto-progression.ts` only if strictly necessary for current-rep reset/ownership alignment
- squat-only smoke/regression tests

Secondary review-only files (modify only if truly necessary):

- `src/lib/camera/evaluators/squat-low-rom-angle-rule.ts`
- `src/lib/camera/evaluators/squat-shallow-structural-owner.ts`
- `src/lib/camera/squat/shallow-completion-contract.ts`

## Non-goals

- No threshold changes.
- No timing constant changes.
- No confidence/stable-frame tuning.
- No new success writer.
- No reopen writer reintroduction.
- No broad refactor.
- No non-squat camera changes.
- No UI/funnel/route changes.

## Locked truths

### 1. Single writer remains locked

- success writer stays singular
- owner truth remains reader-only
- UI gate remains suppress-only
- this PR must not add a second success writer

### 2. Temporal contract remains locked

This PR must not weaken canonical temporal order.
It must make the runtime produce a coherent current rep that can satisfy the already-locked order.

### 3. Current-rep ownership must be coherent across layers

For one rep, these layers must refer to the same owned attempt:

- attemptStarted / descendConfirmed
- baselineFrozen / peakLatched / peakLatchedAtIndex
- completion timestamps
- pass-core timestamps
- reversal/recovery ownership

A later layer must not keep stale timestamps from a prior rep while pass-core has already moved to a new one.

### 4. Peak ownership must not float independently of rep ownership

`peakLatchedAtIndex`, `peakAtMs`, and baseline freeze state must belong to the same current rep that owns descent start.

### 5. Helper/proof stays downstream

The following remain support-only and must not outrun owner truth:

- `officialShallowPathCandidate`
- `officialShallowPathAdmitted`
- `officialShallowStreamBridgeApplied`
- `officialShallowAscentEquivalentSatisfied`
- `officialShallowClosureProofSatisfied`
- trajectory/provenance/helper signals

### 6. False-pass guards remain locked

Must still fail-close:

- setup motion
- standing sway
- seated state
- sitting down only
- mid-ascent before standing recovered
- series-start contamination
- `peakLatchedAtIndex <= 0` contamination
- degenerate pseudo-cycle with no legal epoch

## Required implementation direction

### A. Realign current-rep start / arming ownership

The runtime must not begin recognizing shallow bottom/commit evidence significantly earlier than it begins owning the corresponding attempt.

If shallow evidence appears while `attemptStarted=false` and the same motion later becomes the owned rep, the ownership boundary is too late.

This PR must realign that boundary.

### B. Realign baseline freeze / peak latch to the same owned rep

The runtime must not keep `baselineFrozen=false` / `peakLatched=false` while already treating the same motion as a shallow attempt.

Peak latch/baseline freeze must be brought into the same current-rep window.

### C. Propagate one epoch source through both completion and pass-core

If completion sees `descendConfirmed=true`, pass-core must not remain permanently on `descentStartAtMs=null` for the same rep.

This PR must make the same owned descent epoch flow through both layers.

### D. Eliminate cross-layer stale rep timestamps

Completion timestamps must not remain pinned to an earlier rep while pass-core has already moved to a later rep.

This PR must ensure current-rep reset/rebind semantics are explicit and consistent.

### E. Reversal ownership must belong to the same rep

A reversal seen in helper/rule space is not enough.
The pass-core/current-rep owner must be able to bind reversal to the same rep that owns the peak.

## Explicitly disallowed implementation direction

- tuning thresholds to brute-force shallow pass
- widening reversal/recovery acceptance without fixing ownership
- adding more helper/proof shortcuts
- reintroducing reopen behavior
- letting stale completion timestamps survive across rep boundaries
- masking the problem at final UI gate only

## Acceptance tests

### A. Live-style shallow / ultra-shallow current-rep coherence

Add fixtures based on observed live JSON where a real shallow rep currently fails.
Verify the same rep now carries coherent:

- attemptStarted
- descentStartAtMs
- baselineFrozen/peakLatched
- peakAtMs
- reversalAtMs
- standingRecoveredAtMs

### B. No cross-layer timebase split

For a target rep, completion and pass-core must not report different rep timestamps for what should be the same current attempt.

### C. Canonical contract still enforced

Legal order still required:

- descent < peak < reversal < standing recovery

### D. False-pass zero tolerance

Must still fail:

- setup motion
- standing sway
- seated state
- sitting down only
- mid-ascent
- series-start contamination
- degenerate pseudo-cycle

### E. Helper-positive but owner-negative confusion reduced

For the target live-style path, support/helper truth should no longer become strongly positive far ahead of coherent owner truth.

## Suggested verification matrix

- live-fixture: arming-late / bottom-first shallow rep
- live-fixture: peak latch missing / freeze missing shallow rep
- live-fixture: completion/pass-core timestamp split
- canonical order enforcement
- series-start fail-close
- no early pass guarantee
- owner contradiction invariant
- false-pass guard preservation

## Completion condition

This PR is complete only when all of the following are true:

1. legitimate shallow / ultra-shallow reps can travel through one coherent current rep
2. attempt/baseline/peak/descent/reversal/recovery ownership are aligned to the same rep
3. completion and pass-core no longer drift onto different rep timebases for the target live path
4. helper/proof remains downstream
5. false-pass signatures remain blocked

## Implementation note

Any implementation generated from this document must read this file first and restate the locked truths before code changes. Skipping the read step is non-compliant.
