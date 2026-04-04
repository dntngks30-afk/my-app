# PR-14 SSOT — POLICY / EVALUATOR / CANONICAL BOUNDARY CONVERGENCE

## Goal
Make policy, evaluator demotion, and canonical close all consume one aligned shallow gold-path status instead of overlapping partial truths.

## Why this PR exists
Right now the repo still tells the shallow story through multiple layers:
- canonical contract
- ultra-low policy lock
- meaningful-shallow evaluator demotion
- final UI/progression fields

Single writer exists, but single authority story is not yet clean.

## Product law
There must be exactly one authoritative shallow gold-path status object after completion evaluation.
Other layers may consume it.
They may not reinterpret or partially recreate it.

## New boundary rule
After this PR:
- canonical layer derives closeability facts
- boundary layer synthesizes one shallow gold-path status
- policy and evaluator gates consume that status
- UI/progression consume final result only

## Explicit non-goals
Do NOT:
- create a second pass writer
- move pass ownership into UI
- relax current timing/ownership requirements
- restore bridge/proof authority

## Required design
Introduce a single read-only status object, for example conceptually:
- `shallowGoldPathEligible`
- `shallowGoldPathSatisfied`
- `shallowGoldPathBlockedReason`
- `shallowGoldPathSource`
- `currentRepEpochStatus`

This object must be computed once from canonical + current-rep facts.
Then:
- `applyUltraLowPolicyLock()` consumes it
- `getShallowMeaningfulCycleBlockReason()` consumes it
- UI/progression debug surfaces read it

## Required repo changes
Likely files:
- `src/lib/camera/squat-completion-state.ts`
- `src/lib/camera/evaluators/squat.ts`
- `src/lib/camera/evaluators/squat-meaningful-shallow.ts`

## Acceptance tests
### Must improve
- final blocker reason is consistent
- policy and evaluator do not contradict the canonical story
- no later consumer can silently re-authorize a blocked shallow pass

### Must stay true
- one writer only
- same gold-path requirements as PR-12/13

## Recommended model
Sonnet 4.6
Reason: this is boundary ownership / state-machine cleanup.
