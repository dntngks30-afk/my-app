# PASS AUTHORITY ISOLATION RESET SSOT (latest main verified)
Date: 2026-04-04
Repo: dntngks30-afk/my-app
Branch baseline: origin/main (user-provided latest main URL)

## 0. Why this reset exists

Latest main still does **not** have true pass-authority isolation.

Verified on latest main:
- `evaluateSquatCompletionState()` computes completion truth inside `squat-completion-state.ts`, but the evaluator still applies **late-setup suppression** and then `applyUltraLowPolicyLock()` afterward, which can change the effective result again. See `src/lib/camera/evaluators/squat.ts` imports and post-pipeline sequence.
- `auto-progression.ts` then re-reads the finalized state and applies another UI progression latch chain (`computeSquatCompletionOwnerTruth` -> `computeSquatUiProgressionLatchGate` -> extra final-pass blockers), so practical "pass" is still multi-owner.
- `squat-completion-state.ts` still contains core completion, canonical contract derivation, canonical closer, ultra-low policy logic, drift handling, and observability in one state-heavy module.

Therefore the prior "separations" were not true authority isolation.
They were layered refinements on top of a shared state bag.

## 1. Product law (hard lock)

### 1.1 Pass law
A squat must pass if and only if all of the following are captured within the same rep:
1. meaningful descent
2. meaningful reversal / ascent
3. standing recovery

If that same rep is real, it should pass reliably and quickly.
Target product law: real shallow or deep squats should pass 10/10 under stable capture.

### 1.2 Never-pass law
The following must never pass:
- standing only
- descent only
- still descending
- too-fast bounce / micro-dip / jitter spike
- camera setup movement / framing reposition
- unrelated body motion that is not a squat cycle
- cross-rep laundering (descent from one rep, reversal/recovery from another)

### 1.3 Separation law
Pass and internal interpretation are fully separated.

Pass answers:
- "Was there a valid squat rep?"

Internal interpretation answers:
- shallow / low / standard / depth band
- quality / confidence / warnings
- low-quality pass vs clean pass
- policy / explanation / reporting

Interpretation must never revoke an already-opened valid pass.

## 2. Latest-main diagnosis (verified)

### 2.1 Current practical pass ownership is split across 3 layers

#### Layer A — completion-state
`src/lib/camera/squat-completion-state.ts`
- computes completion truth
- derives canonical shallow contract
- applies canonical shallow closer
- still contains ultra-low policy helper logic
- still carries observability and drift logic in same module

#### Layer B — evaluator boundary
`src/lib/camera/evaluators/squat.ts`
After `evaluateSquatCompletionState()` returns, evaluator still does:
1. setup-phase stamping
2. late-setup suppression (may rewrite completion result)
3. `attachShallowTruthObservabilityAlign01`
4. `applyUltraLowPolicyLock` (may rewrite result again)

#### Layer C — auto progression / UI pass
`src/lib/camera/auto-progression.ts`
Auto progression still treats final pass as:
- completion owner truth
- UI latch gate
- extra final-pass blockers
- confidence / pass confirmation / integrity / setup gates

That means "completion passed" and "user actually passes" are still not one authority.

### 2.2 Root cause
The real root cause is not one threshold.
It is that latest main still has:
- completion truth
- policy truth
- UI pass truth
- debug trace truth
all participating in the practical pass outcome.

That is why fixing one bottleneck creates another.

## 3. Reset objective

This reset introduces a **single pass authority core**.

Only one module may answer:
- `passDetected = true`

No downstream module may turn that into false.

Downstream modules may only:
- classify
- warn
- explain
- suppress UI celebration timing if strictly necessary for non-motion reasons
- but never revoke the rep itself

## 4. New architecture (must be implemented as-is)

### 4.1 New module
Create a new module:

`src/lib/camera/squat/pass-core.ts`

This module is the only owner of squat rep pass truth.

### 4.2 Pass Core input
Pass core may read only the minimum signals necessary:
- readiness-minimum / setup-clear input
- per-frame depth stream
- timestamps
- valid-frame continuity
- current-rep segmentation helpers
- standing recovery threshold helpers

It must NOT read:
- official_shallow_cycle
- low_rom_cycle
- ultra_low_rom_cycle
- canonical shallow contract
- ultra-low policy lock
- interpretation quality labels
- user-facing policy labels

### 4.3 Pass Core output
Pass core outputs a small immutable result:

```ts
type SquatPassCoreResult = {
  passDetected: boolean;
  passBlockedReason: string | null;
  repId: string | null;

  descentDetected: boolean;
  reversalDetected: boolean;
  standingRecovered: boolean;

  descentStartAtMs?: number;
  peakAtMs?: number;
  reversalAtMs?: number;
  standingRecoveredAtMs?: number;
  cycleDurationMs?: number;
  reversalToStandingMs?: number;

  setupClear: boolean;
  currentRepOwnershipClear: boolean;
  antiFalsePassClear: boolean;

  trace: string;
}
```

`passDetected` is the only motion pass authority.

### 4.4 Hard pass criteria
Pass core must open pass only when all are true in the same rep:
- setup clear
- meaningful descent detected
- meaningful reversal detected
- standing recovery detected
- current-rep ownership clear
- anti-false-pass clear

### 4.5 Hard never-pass criteria
Pass core must never open pass when any of these are true:
- setup motion active / framing reposition
- no descent
- descent without reversal
- reversal without standing recovery
- peak/reversal/standing belong to different reps
- too-fast bounce below minimum rep integrity
- event spike / one-frame spike / jitter-only pattern
- seated or mid-rise state when pass would open
- standing still / micro sway / fake depth threshold without non-degenerate movement

## 5. What moves out of pass authority

### 5.1 canonical shallow contract
`deriveCanonicalShallowCompletionContract` is no longer allowed to open or revoke pass.
It becomes interpretation / observability only.

### 5.2 official_shallow / low_rom / ultra_low labels
These become **post-pass interpretation labels only**.

No label may own pass.

### 5.3 ultra-low policy
`applyUltraLowPolicyLock()` must no longer rewrite:
- completionSatisfied
- completionPassReason
- completionBlockedReason
- officialShallowPathClosed

It becomes read-only interpretation / reporting policy.

### 5.4 evaluator late-setup suppression
Late setup suppression may not revoke a valid rep pass anymore.
Setup motion must be enforced **before** pass opens, inside Pass Core.
If setup was not clear, pass must never open.
If pass opened, downstream evaluator cannot revoke it.

### 5.5 auto-progression
Auto progression must treat pass core as authoritative.
It may gate:
- UI latch timing
- celebration display
- confirmation frames
but not motion truth itself.

Practical rule:
- `passDetected` = motion truth
- `finalPassEligible` / `uiProgressionAllowed` = UI state only

Never mutate motion truth.

## 6. Required file-level reset

### 6.1 `src/lib/camera/squat-completion-state.ts`
Must stop owning final pass authority.
Allowed after reset:
- build state facts
- expose debug
- compute interpretation metadata
Forbidden after reset:
- being the only practical owner of pass while downstream can still revoke it
- carrying ultra-low policy rewrites that change pass truth

### 6.2 `src/lib/camera/evaluators/squat.ts`
Must stop rewriting completion truth after pass core.
Required:
- consume `pass-core.ts`
- package debug / interpretation
- no post-hoc motion truth revocation
- `applyUltraLowPolicyLock` must be converted to non-authoritative interpretation projection

### 6.3 `src/lib/camera/auto-progression.ts`
Must stop being a hidden second pass owner.
Required:
- read pass core result
- use it as motion truth
- keep UI latch logic separate
- all extra blockers must block UI celebration only, not the rep truth

## 7. Acceptance matrix (hard)

### 7.1 Must pass (10/10 target)
- legitimate shallow squat: meaningful descent -> reversal -> standing recovery
- legitimate deep squat: meaningful descent -> reversal -> standing recovery
- faster but still real shallow squat within allowed minimum integrity window
- slower shallow squat
- low quality but real squat cycle (passes, interpretation downgraded separately)

### 7.2 Must never pass (0/10 target)
- standing only
- descent only
- mid-descent still lowering
- too-fast bounce / dip spike
- setup camera reposition
- jitter spike
- unrelated movement
- seated hold without recovery
- cross-rep stitched fake cycle

## 8. Mandatory implementation principles

1. One motion pass writer only
2. Zero downstream pass revokers
3. Interpretation never revokes pass
4. Policy never revokes pass
5. UI gate never revokes pass
6. Setup rejection must happen before pass opens
7. Same-rep ownership must be explicit
8. Existing debug richness should remain, but as read-only trace

## 9. Required migration strategy

### Step 1
Introduce `pass-core.ts` with independent tests.

### Step 2
Make evaluator read pass core result and package it.

### Step 3
Freeze downstream rewrites:
- late-setup suppression no longer rewrites pass truth
- ultra-low policy no longer rewrites pass truth

### Step 4
Reinterpret old fields:
- `official_shallow_cycle`, `low_rom_cycle`, `ultra_low_rom_cycle`
become classification outputs from a passed rep, not owners.

### Step 5
Update auto-progression to consume pass truth as immutable.

## 10. Hard regression guards

- No function after Pass Core may set pass from true to false
- No policy function may rewrite motion-truth fields
- No label band may own pass
- No debug contract may own pass
- No UI latch gate may own pass
- A real squat may pass even if interpretation says low quality
- A fake/non-squat pattern may not pass even if some interpretation fields look satisfied

## 11. Explicit latest-main finding that changes this design

This reset must include evaluator and auto-progression,
not just `squat-completion-state.ts`,
because latest main still applies:
- late setup suppression in evaluator
- ultra-low policy rewrite in evaluator
- completion owner + UI gate + extra blockers in auto-progression

So a "completion-state-only" refactor is insufficient.

## 12. Success condition for this reset

The reset is successful only if:
- a valid squat rep has exactly one pass authority
- that authority is opened only by descent -> reversal -> standing recovery within one rep
- no downstream layer can revoke it
- internal quality / ROM / policy become fully read-only interpretation layers
