# PR-12 SSOT — OFFICIAL SHALLOW GOLD-PATH CONVERGENCE

## Goal
Make `official_shallow_cycle` obey the same gold-path authority law that PR-11 already imposed on `ultra_low_rom_cycle`.

In plain terms:
- bridge/proof may remain observability or support signals,
- but they must no longer be sufficient close-authority inputs by themselves.

## Why this PR exists
Current repo state still allows the canonical shallow contract to treat bridge/proof-style facts as reversal evidence.
That means `official_shallow_cycle` remains a residual fallback lane.

## Product law
A shallow pass may open only when the current rep has all of the following:
1. admitted current rep
2. real descend truth
3. real downward commitment
4. current-rep epoch integrity (`baselineFrozen`, `peakLatched`)
5. gold-path reversal truth (`rule` or `rule_plus_hmm`)
6. recovery truth
7. standing finalize truth
8. timing integrity (existing thresholds only)
9. anti-false-pass integrity

## Explicit non-goals
Do NOT:
- add new numeric thresholds
- loosen timing gates
- reintroduce event promotion ownership
- make trajectory rescue a pass writer
- change standard/deep path behavior
- change UI/session rail/product copy

## Authority law after this PR
### Allowed close authority
- rule reversal
- HMM-assisted rule reversal

### Allowed support-only signals
- `officialShallowStreamBridgeApplied`
- `officialShallowAscentEquivalentSatisfied`
- `officialShallowClosureProofSatisfied`
- `officialShallowPrimaryDropClosureFallback`
- `guardedShallowTrajectoryClosureProofSatisfied`

Support-only signals may explain or annotate a close.
They may not independently satisfy reversal evidence for the canonical closer.

## Required repo changes
### 1. Canonical contract
In `src/lib/camera/squat/shallow-completion-contract.ts`:
- stop letting bridge/proof/suffix signals independently satisfy `reversalEvidenceFromInput()`
- introduce or use an explicit gold-path reversal input grounded in rule/HMM truth
- keep weak-event, timing, epoch, commitment, ownership, recovery, and anti-false-pass gates intact

### 2. Completion state projection
In `src/lib/camera/squat-completion-state.ts`:
- preserve existing debug/provenance fields
- ensure canonical closer receives an explicit gold-path reversal fact
- do not delete bridge/proof fields; downgrade them to support/observability only

### 3. Evaluator contract
In `src/lib/camera/evaluators/squat-meaningful-shallow.ts`:
- keep current `official_shallow_cycle` timing and phase protections
- do not let evaluator reintroduce bridge-assisted authority after canonical shrink

## Acceptance tests
### Must pass
- legit shallow current-rep with `reversalConfirmedBy = rule` and valid timing still passes
- legit shallow current-rep with `reversalConfirmedBy = rule_plus_hmm` still passes
- PR-11 ultra-low gold-path fixtures remain green

### Must fail
- bridge-only official shallow closure
- proof-only official shallow closure
- guarded-trajectory-only official shallow closure
- stale close where rule/HMM reversal is absent but suffix/proof exists

### Must remain unchanged
- standard cycle
- deep standard path
- low_rom_cycle clean gold path
- policy handling for clearly illegitimate ultra-low

## Recommended model
Sonnet 4.6
Reason: this PR is contract/authority/source-of-truth work with regression risk.
