# PR-13 SSOT — SHALLOW CURRENT-REP ACQUISITION STABILIZATION

## Goal
After PR-12 removes bridge-only authority, make legitimate shallow reps arrive at the gold path more reliably through current-rep acquisition itself.

This PR is not about reopening bridge authority.
It is about improving clean capture of:
- arming
- freeze/latch handoff
- current-rep segmentation
- rule/HMM reversal capture

## Why this PR exists
The uploaded device log shows repeated oscillation among:
- `not_armed`
- `no_reversal`
- `ultra_low_rom_not_allowed`

This means legitimate shallow motion is often not captured cleanly enough in the strict lane before support signals become relevant.

## Product law
A legit shallow rep must pass because the system truly captured the current rep, not because closure suffixes repaired a weak acquisition.

## Explicit non-goals
Do NOT:
- widen 200ms / 7500ms timing thresholds
- restore bridge/proof as authority
- weaken policy gates
- add event promotion as pass owner
- change UI or auto-progression semantics

## Stabilization targets
### 1. Current-rep epoch quality
Improve how the current rep reaches:
- `baselineFrozen = true`
- `peakLatched = true`
- coherent slice start
without relying on later suffix repair.

### 2. Attempt admission quality
Admission may stay permissive enough for shallow users,
but it must not race too far ahead of current-rep epoch truth.

### 3. Rule/HMM reversal capture quality
Legitimate shallow current-rep motion should produce `reversalConfirmedByRuleOrHmm = true` earlier and more consistently when the user really performed down-up-return.

### 4. Weak-event handling
When event-cycle is weak or not detected:
- the system may stay pending,
- but it must not silently drift toward closeability via support-only paths.

## Required repo changes
Potentially involved files:
- `src/lib/camera/squat-completion-state.ts`
- `src/lib/camera/squat/squat-reversal-confirmation.ts`
- `src/lib/camera/squat/squat-event-cycle.ts`
- `src/lib/camera/evaluators/squat.ts`

Allowed changes:
- current-rep segmentation improvements
- freeze/latch timing cleanup
- rule/HMM reversal acquisition stabilization
- better shallow pending-state handling before close

## Acceptance tests
### Must improve
- fewer transitions through `not_armed -> no_reversal -> ultra_low_rom_not_allowed`
- legitimate shallow current-rep cases produce rule/HMM reversal without depending on bridge-only close
- fewer `freeze_or_latch_missing` / `descent_weak` / `recovery_tail_weak` states for legit reps

### Must not regress
- deep path
- low_rom clean path
- PR-12 official_shallow authority shrink
- PR-11 ultra-low gold-path protections

## Recommended model
Sonnet 4.6
Reason: this is temporal/stateful motion-logic work with hidden coupling risk.
