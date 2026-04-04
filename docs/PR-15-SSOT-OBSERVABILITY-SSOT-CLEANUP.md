# PR-15 SSOT — OBSERVABILITY SSOT CLEANUP

## Goal
Align debug, per-step, pass-snapshot, and completion observability so device validation is trustworthy and fast.

## Why this PR exists
The uploaded device log shows cases where:
- per-step descent/ascent counts are zero,
- but completion truth says descend/reversal/recovery all happened,
- and pass is latched.

That may be explainable, but it is not easy to debug.

## Product law
Observability must explain the winning truth.
Debug surfaces may be richer than product surfaces, but they must not tell a contradictory story.

## Explicit non-goals
Do NOT:
- rewrite pass logic
- change thresholds
- change ownership again
- fold debug alignment into product behavior changes

## Required design
Add one shallow observability SSOT object that surfaces:
- gold-path status
- truth source for descend/reversal/recovery
- current-rep epoch state
- why bridge/proof was or was not used
- why pass was or was not latched

Per-step / highlighted / pass snapshot should read from aligned truth-source fields,
not from unrelated phase counters alone.

## Required repo changes
Likely files:
- `src/lib/camera/evaluators/squat.ts`
- `src/lib/camera/evaluators/squat-meaningful-shallow.ts`
- any debug snapshot builders / smoke scripts
- docs

## Acceptance tests
- final pass snapshot explains the exact winning path
- per-step / pass-snapshot / completion debug no longer look mutually contradictory on legit shallow passes
- existing logic is unchanged except debug alignment

## Recommended model
Composer 2.0
Reason: this is observability, reporting, and low-risk alignment work after the structural PRs land.
