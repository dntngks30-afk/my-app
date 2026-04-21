# PR-SHALLOW-ANCHOR-PROVENANCE-RESET-AND-SPAN-ALIGN-01

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
- `docs/pr/PR-SHALLOW-CLOSE-COMMIT-CONTRACT-ALIGN-01.md`

## One-line purpose
Reset shallow anchor provenance to the current admitted rep and align close-span evaluation to that same rep boundary, without reopening absurd pass and without changing the completion-owner opener law.

## Locked observed truth

### 1. Weird-pass families remain blocked
Standing still, seated hold, setup contamination, stale prior rep, mixed-rep contamination, early-pass, and pass-core-only adversarial cases remain blocked and must stay blocked.

### 2. Deep standard path remains healthy
Deep / standard squat still passes through `standard_cycle` and must remain untouched.

### 3. The remaining shallow failure is dominated by anchor provenance drift
Recent device traces show the following recurring structure:

#### Class A — pre-attempt / arming failure
Early windows still show:
- `completionBlockedReason = not_armed`
- `baselineFrozen = false`
- `peakLatched = false`
- `peakLatchedAtIndex = 0`
- eventCycle notes include `freeze_or_latch_missing`
- shallow intent is already visible (`downwardCommitmentReached = true`, shallow band depth, descend-aligned hints)

#### Class B — admitted shallow with full visible close proof still blocked by span labels
Later windows can show:
- `officialShallowPathAdmitted = true`
- `officialShallowStreamBridgeApplied = true`
- `officialShallowAscentEquivalentSatisfied = true`
- `officialShallowClosureProofSatisfied = true`
- `officialShallowReversalSatisfied = true`
- but still `officialShallowPathClosed = false`
- and `completionBlockedReason = descent_span_too_short` or `ascent_recovery_span_too_short`

#### Class C — stronger late state still carries series-start anchor truth
Later admitted windows can also show:
- `baselineFrozen = true`
- `peakLatched = true`
- yet `peakLatchedAtIndex = 0`
- eventCycle notes such as `peak_anchor_at_series_start`, `descent_weak`, `recovery_tail_weak`
- and the rep still never closes.

This means the dominant residual is no longer just close-commit coherence.
The dominant residual is:

**current-rep shallow close truth and peak/latch anchor provenance are still not aligned to the same admitted rep boundary.**

## Critical law (unchanged)
The final-pass opener remains completion-owner only.
Nothing in this PR may weaken, bypass, or replace that law.

## Core diagnosis
The current shallow path can:
- observe shallow intent,
- admit some shallow reps,
- sometimes prove same-rep bridge / reversal / ascent-equivalent / closure truth,
- sometimes even freeze baseline and latch peak,

but the anchor provenance used by close-span / recovery-span evaluation can still remain stuck at series-start or invalid index truth (`peakLatchedAtIndex = 0`).

Therefore the next PR must not be another writer-only patch or another blocker-only patch.
It must align **anchor provenance reset + span evaluation** to the current admitted shallow rep.

## Scope
In scope:
- `src/lib/camera/squat-completion-state.ts`
- `src/lib/camera/squat/squat-completion-canonical.ts` only if needed to keep final writer truth aligned after upstream provenance reset
- optional tiny helper extraction directly supporting current-rep anchor provenance or span alignment
- focused shallow anchor-provenance / span-alignment smokes only

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

### Rule 2 — Current-rep provenance must be explicit
A shallow rep may not close using stale or series-start anchor truth.
The anchor used for shallow close must belong to the same admitted rep that established same-rep shallow close truth.

### Rule 3 — Fix provenance first, then span truth
Do not patch this by simply clearing `descent_span_too_short` / `ascent_recovery_span_too_short` later.
Span evaluation must be aligned to the reset current-rep anchor provenance itself.

### Rule 4 — Anchorless or stale-anchor reps must still fail
If the rep does not have current-rep truthful anchor provenance, it must remain blocked even if some shallow intent signals are visible.

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
- anchor provenance has been reset to the current admitted shallow rep
- close-span / ascent-recovery-span evaluation is aligned to that current admitted rep anchor
- the shallow contract then commits to `officialShallowPathClosed = true`
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
- anchor provenance remains stale / invalid / series-start truth
- completion-owner truth not satisfied

## Suggested technical direction

### Direction A — isolate where series-start / invalid anchor is retained
Identify the exact branch/conjuncts where:
- `peakLatchedAtIndex = 0`
- `peak_anchor_at_series_start`
- or equivalent stale anchor provenance
continues to survive after the current shallow rep is already admitted.

### Direction B — reset provenance at the admitted current-rep boundary
Once the shallow rep is already admitted and genuine same-rep shallow close truth begins to form, reset anchor provenance to the current admitted rep boundary.
This may require:
- separating global/series-start anchor truth from current admitted rep anchor truth
- preventing stale series-start anchor reuse
- synchronizing baselineFrozen / peakLatched / peakLatchedAtIndex to current admitted rep truth

### Direction C — align span evaluation to the reset anchor
After anchor provenance is reset to the current rep, align:
- `descent_span_too_short`
- `ascent_recovery_span_too_short`
- related weak-span interpretation
so they evaluate the same current admitted rep instead of stale provenance.

### Direction D — preserve truthful diagnostics
If provenance reset changes close behavior, preserve enough diagnostics to show:
- why the rep closed
- which anchor provenance path was used
- that weird-pass blockers were not bypassed

## Required proof posture
Add:
- `scripts/camera-pr-shallow-anchor-provenance-reset-and-span-align-01-smoke.mjs`

This smoke must prove:
- admitted shallow reps with genuine same-rep close truth and current-rep anchor provenance now close and pass
- series-start / stale anchor provenance cannot be reused as current-rep shallow truth
- reps with no genuine current-rep reversal/recovery still fail
- weird-pass negatives remain blocked
- deep standard remains standard path
- no state remains where current-rep shallow close truth is satisfied but span evaluation still reads stale series-start anchor provenance

Also add it to PR-F proof gate as mandatory. No skip expansion.

## Acceptance criteria
- meaningful shallow passes 10/10 when performed consistently on current head or equivalent device truth
- admitted shallow no longer stalls because `peakLatchedAtIndex = 0` / series-start anchor truth survives into close-span evaluation
- weird-pass families remain blocked
- no `completionTruthPassed = false` / `finalPassGranted = true`
- no pass-core reopening
- no registry grant path
- deep standard stays green

## One-line lock
Recover shallow squat only by resetting anchor provenance to the current admitted shallow rep and aligning close-span evaluation to that same rep boundary, while keeping all weird-pass reopeners permanently blocked.