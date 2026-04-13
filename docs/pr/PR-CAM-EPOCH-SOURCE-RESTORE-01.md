# PR-CAM-EPOCH-SOURCE-RESTORE-01

> This document is the SSOT for restoring the **owned descent epoch source** for shallow / ultra-shallow squat pass truth.
>
> It is intentionally narrow. This is **not** a broad squat redesign PR. This is a **minimal structural recovery PR** to make the already-locked temporal contract reachable again for legitimate real-device shallow reps.

## Why this PR exists

Current runtime behavior shows a structural gap:

- shallow / ultra-shallow helper signals can become positive
- shallow admission can become true
- canonical shallow temporal contract is now strict
- but the owned descent epoch source is still missing in live runtime

The recurring live symptom is:

- `descentDetected === true`
- while `passCore.descentStartAtMs == null`
- while completion may still show shallow helper/proof positive
- and the final result remains blocked as `no_reversal_after_peak`, `reversal_span_too_short`, or `completion_not_satisfied`

This means the system sees motion, but does not legally own the rep start.

## Locked diagnosis

### 1. The current failure is not primarily a reopen/writer problem

That class of regression is already mostly closed.

The current failure is upstream:

> The live runtime is failing to produce a legal owned descent epoch for legitimate shallow reps.

### 2. The temporal contract is stricter than the available live inputs

Recent locking PRs correctly made canonical shallow closure require:

- `descentStartAtMs`
- `peakAtMs`
- `reversalAtMs`
- `standingRecoveredAtMs`
- strict ordering among them

But that only works if the runtime can actually produce those timestamps from a legal source.

### 3. The missing piece is the epoch source, not more helper proof

If `descentDetected` is true but `descentStartAtMs` remains null, the rep is in a forbidden half-state.

Adding more helper/proof/admission logic is the wrong direction.
The missing part is the owned source for `descentStartAtMs` in the current rep.

### 4. Rescue wrappers must not require already-passed owner truth

Promotion/rescue paths that require `passCore.passDetected === true` are not rescue paths anymore.
They become circular and unusable for the cases they are supposed to restore.

This PR must avoid that circular dependency.

## Objective

Restore a legal, minimal, owner-grade descent epoch source so that legitimate real-device shallow / ultra-shallow reps can reach the already-locked temporal contract.

This PR must:

- restore a legal source for `descentStartAtMs`
- preserve the single-writer structure
- keep helper/proof downstream of owner truth
- avoid reopening seated/setup/series-start false passes
- avoid circular rescue logic that requires `passDetected === true` before rescue can even run

## Scope

Allowed scope is intentionally narrow.

Primary target files:

- `src/lib/camera/squat/squat-completion-core.ts`
- squat-only minimal helper / adapter files if strictly required
- squat-only smoke tests needed to prove the fix

Secondary review-only files (modify only if strictly necessary):

- `src/lib/camera/evaluators/squat-low-rom-angle-rule.ts`
- `src/lib/camera/evaluators/squat-shallow-structural-owner.ts`
- `src/lib/camera/squat-completion-state.ts`
- `src/lib/camera/squat/shallow-completion-contract.ts`
- `src/lib/camera/squat/squat-completion-canonical.ts`

## Non-goals

- No threshold changes.
- No timing constant changes.
- No confidence / stable-frame changes.
- No reopen writer reintroduction.
- No helper/proof promotion to final owner.
- No broad refactor.
- No non-squat camera changes.
- No UI / route / funnel changes.

## Locked truths

### 1. Single writer remains locked

- success writer stays singular
- owner truth remains reader-only
- UI gate remains suppress-only
- this PR must not add a second success writer

### 2. Temporal epoch contract remains locked

This PR does **not** weaken the contract.
It restores the input source needed to satisfy it.

A legal shallow rep still requires:

1. descent start exists
2. peak exists after descent start
3. reversal exists after peak
4. standing recovery exists after reversal
5. finalize/standing recovery truth exists

### 3. Helper/proof stays downstream

The following remain support-only:

- `officialShallowPathCandidate`
- `officialShallowPathAdmitted`
- `officialShallowStreamBridgeApplied`
- `officialShallowAscentEquivalentSatisfied`
- `officialShallowClosureProofSatisfied`
- trajectory/provenance fallback signals

They may not become owner truth.

### 4. Live half-state is illegal

The following remains illegal and must still fail-close:

- `descentDetected === true` with `descentStartAtMs == null`

This PR is complete only if it reduces this half-state for legitimate reps by restoring a legal source.

### 5. No circular rescue dependency

A rescue/promotion path must not require `passCore.passDetected === true` in order to become active for shallow recovery.

`passDetected === true` may be used as validation/diagnostic evidence, but not as the activation precondition for the very rescue path intended to restore pre-pass shallow truth.

## Required implementation direction

### A. Restore descent epoch source at the core

The preferred direction is:

- restore or reintroduce the minimal shared/current descent source in `squat-completion-core.ts`
- derive `effectiveDescentStartFrame` from the earliest legal source among:
  - explicit completion descent frame
  - trajectory descent start frame
  - shared descent truth
- ensure the chosen source belongs to the current legal rep window

This is the heart of the PR.

### B. Keep source restoration narrow and explicit

Do not scatter epoch reconstruction across multiple wrappers.

The owned source should come from one narrow core boundary and then flow outward into:

- completion state timestamps
- canonical shallow contract input
- downstream shallow/ultra wrappers

### C. Prevent rescue circularity

If a rescue/promotion helper currently requires `passCore.passDetected === true` merely to activate, that requirement must be removed or narrowed.

A valid replacement must rely on:

- legal timestamp presence/order
- legal current-rep ownership
- existing anti-false-pass guards

not on already having passed.

### D. Do not reopen false pass regressions

The following remain hard fail-close:

- setup motion
- standing sway
- seated hold
- sitting-down only
- mid-ascent before standing recovered
- series-start contamination
- `peakLatchedAtIndex <= 0`
- degenerate pseudo-cycle with no legal epoch

## Explicitly disallowed implementation direction

- adding more helper/proof shortcuts
- reintroducing reopen writer behavior
- weakening the canonical temporal contract
- allowing pass with missing epoch timestamps
- using final UI veto as the primary fix
- broadening rescue so much that seated/setup false passes can sneak through
- requiring `passDetected === true` to activate a rescue path

## Acceptance tests

### A. Legit live-style ultra-low shallow rep

Must pass when the rep has:

- legal descent epoch
- legal peak
- legal reversal
- legal standing recovery
- no contamination

### B. Legit live-style shallow rep

Must pass under the same epoch law.

### C. Deep standard preserved

Standard deep path must remain intact.

### D. False-pass zero tolerance

Must still fail:

- setup motion
- standing sway
- seated state
- sitting down only
- mid-ascent
- series-start contaminated peak
- degenerate timing pseudo-cycle

### E. Half-state reduction / source verification

Add proof that the targeted live shallow path no longer dies solely because:

- `descentDetected === true`
- but `descentStartAtMs == null`

### F. No circular rescue activation

If rescue/promotion is used, prove it does not depend on `passCore.passDetected === true` merely to begin operating.

## Suggested verification matrix

- live-style ultra-low shallow fixture based on observed JSON pattern
- live-style shallow fixture based on observed JSON pattern
- canonical temporal epoch contract still enforced
- setup contamination fail-close
- series-start contamination fail-close
- no early pass guarantee
- owner contradiction invariant
- helper-positive / missing-epoch illegal-state fail-close
- rescue activation without circular `passDetected === true` dependency

## Completion condition

This PR is complete only when all of the following are true:

1. legitimate live-style shallow reps can produce a legal owned descent epoch source
2. the already-locked temporal contract becomes reachable without weakening it
3. helper/proof remains downstream of owner truth
4. false-pass signatures remain blocked
5. rescue/promotion logic does not depend on already having passed

## Implementation note

Any implementation generated from this document must read this file first and restate the locked truths before code changes. Skipping the read step is non-compliant.
