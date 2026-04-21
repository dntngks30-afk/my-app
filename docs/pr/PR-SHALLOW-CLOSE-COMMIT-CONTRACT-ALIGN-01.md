# PR-SHALLOW-CLOSE-COMMIT-CONTRACT-ALIGN-01

Parent SSOT: `docs/SSOT_SQUAT_COMPLETION_FIRST_QUALITY_STRICT_2026_04.md`
Parent Truth Map: `docs/pr/PR-SQUAT-COMPLETION-FIRST-QUALITY-STRICT-TRUTH-MAP-01.md`
Depends on:
- `docs/pr/PR-01-SQUAT-COMPLETION-FIRST-AUTHORITY-FREEZE.md`
- `docs/pr/P1-SQUAT-LEGITIMATE-SHALLOW-EVIDENCE-RECOVERY.md`
- `docs/pr/PR-CAM-SQUAT-AUTHORITY-LAW-RESOLUTION.md`
- `docs/pr/P3-SQUAT-ABSURD-PASS-REGISTRY-NORMALIZATION.md`
- `docs/pr/P2-SQUAT-AUTHORITY-NAMING-COMMENT-CLEANUP.md`
- `docs/pr/PR-SHALLOW-AUTHORITATIVE-CLOSE-WRITER-MISS-OBSERVABILITY-01.md`
- `docs/pr/PR-SHALLOW-PEAK-LATCH-ANCHOR-GUARD-ALIGN-01.md`
- `docs/pr/PR-SHALLOW-ADMITTED-TO-CLOSED-CONTRACT-ALIGN-01.md`

## One-line purpose
Align the shallow close-commit contract so that an admitted same-rep shallow cycle with genuine close truth consistently commits to `officialShallowPathClosed = true`, without reopening absurd pass and without changing the completion-owner opener law.

## Locked observed truth

### 1. Weird-pass families remain blocked
Standing still, seated hold, setup contamination, stale prior rep, mixed-rep contamination, early-pass, and pass-core-only adversarial cases remain blocked and must stay blocked.

### 2. Deep standard path remains healthy
Deep / standard squat still passes through `standard_cycle` and must remain untouched.

### 3. The remaining shallow failure is now a close-commit coherence failure
Recent device traces show all three of the following classes:

#### Class A — admitted shallow still blocked by `no_reversal`
- `officialShallowPathAdmitted = true`
- but `officialShallowPathClosed = false`
- `completionBlockedReason = no_reversal`
- `officialShallowStreamBridgeApplied = false`

#### Class B — admitted shallow has full visible close proof, but still blocked by span labels
- `officialShallowPathAdmitted = true`
- `officialShallowStreamBridgeApplied = true`
- `officialShallowAscentEquivalentSatisfied = true`
- `officialShallowClosureProofSatisfied = true`
- `officialShallowReversalSatisfied = true`
- but `officialShallowPathClosed = false`
- and `completionBlockedReason = descent_span_too_short` or `ascent_recovery_span_too_short`

#### Class C — blocked reason can become null, but close still does not commit
Some windows can reach:
- `completionBlockedReason = null`
- `officialShallowPathBlockedReason = null`
- yet still `officialShallowPathClosed = false` and `completionSatisfied = false`

This means the dominant residual is not one guard in isolation.
The dominant residual is:

**the admitted shallow close contract and the final close commit/write contract are not yet one coherent truth.**

## Critical law (unchanged)
The final-pass opener remains completion-owner only.
Nothing in this PR may weaken, bypass, or replace that law.

## Core diagnosis
The current shallow path is partially repaired in several places, but not yet unified.
The runtime can:
- admit a shallow rep,
- sometimes prove same-rep shallow bridge / reversal / ascent-equivalent / closure proof,
- sometimes even clear local blocked reasons,
- but still fail to commit the rep into `officialShallowPathClosed = true`.

Therefore the next PR must not be another isolated blocker fix or another writer-only exception.
It must align the **admitted → close → commit** shallow contract as one coherent canonical path.

## Scope
In scope:
- `src/lib/camera/squat-completion-state.ts`
- `src/lib/camera/squat/squat-completion-canonical.ts` only as needed to keep the final writer truthful after close-commit alignment
- optional tiny helper extraction directly supporting same-rep shallow close-commit truth
- focused shallow close-commit contract smokes only

Out of scope:
- no authority-law rewiring
- no `auto-progression.ts` opener redesign
- no pass-core reopening
- no P3 registry changes
- no UI latch redesign
- no deep / standard tuning
- no non-squat work
- no broad setup/readiness redesign
- no generic threshold sweep

## Required design rules

### Rule 1 — Completion-owner canonical remains the only opener
Recovered shallow success must still occur only by making canonical completion-owner truth satisfied.

### Rule 2 — Admission alone never closes
`officialShallowPathAdmitted = true` alone must never pass and must never auto-close.

### Rule 3 — Visible shallow close truth must have a single canonical commit path
If same-rep shallow close truth is genuinely present, the system must have exactly one coherent way to commit:
- `officialShallowPathClosed = true`
- `completionSatisfied = true`
- `completionPassReason = official_shallow_cycle`

That commit path must not depend on a different law than the law used to establish admitted shallow close truth.

### Rule 4 — Fix contract coherence, not one-off symptoms
Do not solve this by piling up more isolated exceptions for:
- `no_reversal`
- `descent_span_too_short`
- `ascent_recovery_span_too_short`
- writer-only fallback

The admitted-to-close truth and the final close commit/write truth must be made coherent as one contract.

### Rule 5 — Weird-pass families remain hard-locked
Standing, seated, setup-contaminated, stale, mixed-rep, no real descent, no real reversal, no real recovery, and early-pass cases must remain blocked.

### Rule 6 — Deep standard path remains untouched
Deep/standard squat success is already healthy and must not be retuned.

## Exact target behavior
### This PR must make the following pass
A shallow squat should pass when all are true:
- ready-state start
- same-rep shallow attempt is admitted
- same-rep descend is confirmed
- same-rep reversal and recovery truth are genuinely established, either directly or through the official shallow stream bridge
- official shallow reversal / ascent-equivalent / closure proof are genuinely present
- no setup contamination
- no stale / mixed-rep contamination
- the shallow contract commits to `officialShallowPathClosed = true`
- canonical completion-owner truth then becomes satisfied through the existing opener law

### This PR must keep the following blocked
A shallow squat must still fail when any of these hold:
- no same-rep descend
- no same-rep reversal
- no same-rep recovery
- standing only
- seated only
- setup contamination
- stale or mixed-rep contamination
- early-pass shortcut
- completion-owner truth not satisfied

## Suggested technical direction
### Direction A — isolate the exact close-commit boundary
Identify where the system finally decides all of the following for shallow reps:
- `officialShallowPathClosed`
- `completionSatisfied`
- `completionPassReason`
- `completionBlockedReason`

Do not fix symptoms before isolating this exact close-commit boundary.

### Direction B — unify admitted-shallow truth and close-commit truth
Once a rep is already admitted into the official shallow path, the same-rep shallow close truth must flow into the same canonical commit path.
A rep must not be in the state:
- admitted,
- bridge/proof/reversal satisfied,
- blocked reason cleared or effectively satisfied,
- yet still not committed.

### Direction C — explicitly define the narrow residual cases that must still stay blocked
After admission, the contract must still keep a rep blocked when there is no genuine same-rep reversal/recovery/close truth.
But once that truth is complete, the system must no longer oscillate between blocked reasons and non-commit.

### Direction D — preserve truthful diagnostics
If close-commit alignment changes behavior, preserve enough diagnostics to show:
- why the rep closed
- which shallow truth path committed it
- that weird-pass blockers were not bypassed

## Required proof posture
Add:
- `scripts/camera-pr-shallow-close-commit-contract-align-01-smoke.mjs`

This smoke must prove:
- admitted shallow reps with genuine same-rep close truth now commit to `closed` and pass
- admitted shallow reps without genuine same-rep reversal/recovery still fail
- weird-pass negatives remain blocked
- deep standard remains standard path
- no state remains where shallow close truth is fully satisfied yet `closed = false` without an explicit valid residual blocker

Also add it to PR-F proof gate as mandatory. No skip expansion.

## Acceptance criteria
- meaningful shallow passes 10/10 when performed consistently on current head or equivalent device truth
- admitted shallow no longer oscillates indefinitely between blocker-cleared / blocker-shifted windows while never committing to `closed`
- weird-pass families remain blocked
- no `completionTruthPassed = false` / `finalPassGranted = true`
- no pass-core reopening
- no registry grant path
- deep standard stays green

## One-line lock
Recover shallow squat only by aligning the admitted shallow close truth and the final close commit/write truth into one coherent canonical contract, while keeping all weird-pass reopeners permanently blocked.