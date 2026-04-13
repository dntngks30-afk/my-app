# PR-CAM-PASS-CORE-RESET-AND-REP-ID-ALIGN-01

> This document is the SSOT for fixing the **pass-core stale success leak** and **rep identity / timebase misalignment** in squat pass truth.
>
> This is intentionally narrow. It is not a threshold PR, not a reversal-tuning PR, and not a broad evaluator rewrite. It exists because the runtime is currently violating its own authority contract.

## Why this PR exists

Current live runtime shows a critical contradiction:

- `pass-core` reports `passDetected=true` with a complete rep timeline
- while the current observation/completion layer is still `idle`, `not_armed`, or otherwise not on the same rep
- and downstream UI/final gate still blocks with `completion_owner_not_satisfied` / `completion_truth_not_passed`

This means two things are happening at once:

1. a stale or prior pass-core success is leaking into later observations
2. downstream layers are still effectively allowed to overrule pass-core authority

That is a structural contract violation.

## Locked diagnosis

### 1. pass-core authority contract is currently violated

`pass-core.ts` explicitly states that:

- this module is the only owner of squat motion pass truth
- once `passDetected=true`, downstream layers may classify/warn/gate UI timing
- but may not flip pass truth back to false

Current live JSON contradicts that. A pre-attempt or idle observation can carry `passDetected=true` while UI/final layers still block on completion truth. That is not a threshold issue. It is an authority hierarchy failure.

### 2. stale success is leaking across rep boundaries

Current live traces show pass-core timestamps staying fixed from an earlier success while completion/current observation fields continue changing on a later observation. This means pass-core success is not being reset/rebound cleanly at rep boundaries.

### 3. rep timebase is split across layers

For what should be one current rep:

- pass-core timestamps
- completion timestamps
- event-cycle timestamps
- observation-level phase/attempt state

can point to different rep windows.

### 4. current shallow failure is downstream of this split

Once pass-core stale success and rep-id split exist, shallow/low-rom completion logic becomes impossible to reason about correctly. Any further threshold tuning before fixing reset/alignment risks making the system even less trustworthy.

## Objective

Restore one coherent squat rep authority chain:

1. a new/current rep begins
2. stale pass-core success from prior rep is cleared or rebound
3. pass-core, completion, and event-cycle reference the same rep window
4. if pass-core owns a valid pass for that rep, downstream must not negate it
5. false-pass protections remain locked

## Scope

Primary expected files:

- `src/lib/camera/squat/pass-core.ts`
- `src/lib/camera/squat-completion-state.ts`
- `src/lib/camera/auto-progression.ts`
- squat-only smoke/regression tests

Secondary review-only files (modify only if strictly necessary):

- `src/lib/camera/squat/squat-completion-canonical.ts`
- `src/lib/camera/squat/shallow-completion-contract.ts`
- `src/lib/camera/evaluators/squat.ts`
- event-cycle / trace files only if needed for rep-id / reset observability

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

- pass success writer remains singular
- pass-core remains motion pass authority
- completion/official shallow/helper/proof do not become new success writers

### 2. Downstream must not negate pass-core truth

If pass-core owns a valid pass for the current rep, downstream may:

- suppress celebration timing
- annotate warnings
- explain quality
- delay UI presentation for stable UX

but may not produce a logically contradictory final state where the same rep is both pass-core-pass and final-blocked because completion is unsatisfied.

### 3. Rep boundary reset must be explicit

A prior successful rep must not remain attached to later idle/pre-attempt observations.

This PR must make rep reset / rebinding semantics explicit at the pass-core boundary.

### 4. Cross-layer rep identity must align

For one current rep, the following must refer to the same rep window:

- attemptStarted / descendConfirmed
- pass-core timestamps
- completion timestamps
- baseline/peak/reversal/recovery ownership
- event-cycle summary for that rep

### 5. Helper/proof stays downstream

The following remain support-only:

- `officialShallowPathCandidate`
- `officialShallowPathAdmitted`
- `officialShallowStreamBridgeApplied`
- `officialShallowAscentEquivalentSatisfied`
- `officialShallowClosureProofSatisfied`
- event-cycle/helper/provenance signals

They must not become alternate owners.

### 6. False-pass guards remain locked

Must still fail-close:

- setup motion
- standing sway
- seated state
- sitting down only
- mid-ascent before standing recovered
- series-start contamination
- degenerate pseudo-cycle

## Required implementation direction

### A. Fix pass-core stale success leakage

The runtime must not expose a previous successful pass-core result on later idle/pre-attempt observations for a different rep window.

This requires one or both of:

- explicit reset of pass-core-owned success snapshot when a new rep/observation window is entered
- explicit rep binding so a pass-core result is only visible when it belongs to the current observation/attempt window

### B. Introduce or restore a coherent rep identity boundary

There must be a rep-local identity or equivalent ownership boundary that lets pass-core/completion/event-cycle agree they are talking about the same rep.

This may be an explicit `repId` or an equivalent owner key derived from the same current-rep boundary.

### C. Prevent downstream contradiction

If a pass-core result belongs to the current rep and is valid, downstream final gating must not still emit `completion_truth_not_passed` for that same rep.

If downstream is intentionally gating a different rep window, that mismatch must be impossible or explicit.

### D. Preserve fail-close on genuinely blocked current reps

This PR must not convert genuinely blocked shallow/low-rom reps into passes merely by hiding contradictions.
It must align the same rep across layers, not bypass correctness.

### E. Improve observability for rep identity / stale-pass debugging

Add minimal observability so future logs can answer:

- which rep/window does pass-core belong to?
- which rep/window does completion belong to?
- did a reset occur?
- was a pass-core success suppressed because it was stale / foreign to current rep?

Observability remains sink-only and must not become a new logic owner.

## Explicitly disallowed implementation direction

- threshold tuning to brute-force shallow pass
- letting completion remain a hidden veto over pass-core for the same rep
- masking contradiction only in UI text while keeping inconsistent underlying truth
- adding more helper/proof shortcuts
- reintroducing reopen behavior
- broadening rescue rules before rep identity is fixed

## Acceptance tests

### A. No stale pass on idle/pre-attempt observations

A pre-attempt / idle observation must not expose a prior pass-core success from a previous rep as if it belongs to the current observation.

### B. Same-rep authority coherence

For a target rep, if pass-core owns a valid pass and that pass belongs to the current rep, downstream must not end in `completion_truth_not_passed` for that same rep.

### C. No cross-layer rep timebase split

For a target rep, pass-core/completion/event-cycle timestamps must not represent different rep windows.

### D. Legit blocked reps still blocked

A genuinely incomplete or thin-evidence current rep may still fail-close, but the failure must be coherent across layers for the same rep.

### E. False-pass zero tolerance preserved

Must still fail:

- setup motion
- standing sway
- seated state
- sitting down only
- mid-ascent
- series-start contaminated peak
- degenerate pseudo-cycle

## Suggested verification matrix

- live-fixture: stale pass-core success visible during idle/pre-attempt
- live-fixture: pass-core pass + completion blocked contradiction
- live-fixture: completion/pass-core timebase split
- live-fixture: actual blocked shallow/low-rom rep remains coherently blocked
- no early pass guarantee
- false-pass guard preservation
- rep reset / rep-id observability smoke

## Completion condition

This PR is complete only when all of the following are true:

1. prior pass-core success no longer leaks into unrelated later observations
2. pass-core/completion/event-cycle are aligned to the same rep identity for the target live path
3. downstream no longer logically negates a valid pass-core pass for the same rep
4. genuine blocked reps still fail coherently
5. false-pass guards remain locked

## Implementation note

Any implementation generated from this document must read this file first and restate the locked truths before code changes. Skipping the read step is non-compliant.
