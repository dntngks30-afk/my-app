# PR-SHALLOW-PEAK-LATCH-ANCHOR-GUARD-ALIGN-01

Parent SSOT: `docs/SSOT_SQUAT_COMPLETION_FIRST_QUALITY_STRICT_2026_04.md`
Parent Truth Map: `docs/pr/PR-SQUAT-COMPLETION-FIRST-QUALITY-STRICT-TRUTH-MAP-01.md`
Depends on:
- `docs/pr/PR-01-SQUAT-COMPLETION-FIRST-AUTHORITY-FREEZE.md`
- `docs/pr/P1-SQUAT-LEGITIMATE-SHALLOW-EVIDENCE-RECOVERY.md`
- `docs/pr/PR-CAM-SQUAT-AUTHORITY-LAW-RESOLUTION.md`
- `docs/pr/P3-SQUAT-ABSURD-PASS-REGISTRY-NORMALIZATION.md`
- `docs/pr/P2-SQUAT-AUTHORITY-NAMING-COMMENT-CLEANUP.md`
- `docs/pr/PR-SHALLOW-AUTHORITATIVE-CLOSE-WRITER-MISS-OBSERVABILITY-01.md`

## Working summary

The writer-miss observability step narrowed the remaining shallow failure to the final writer boundary and exposed a concrete hidden guard candidate:
- `peak_latch_anchor_guard_failed`

The newest real-device shallow traces still show the visible same-rep shallow close proof cluster becoming true:
- `officialShallowPathAdmitted = true`
- `officialShallowStreamBridgeApplied = true`
- `officialShallowAscentEquivalentSatisfied = true`
- `officialShallowClosureProofSatisfied = true`
- `officialShallowReversalSatisfied = true`

but the final result remains blocked as:
- `officialShallowPathClosed = false`
- `completionBlockedReason = descent_span_too_short` or `ascent_recovery_span_too_short`

The practical diagnosis is that the canonical writer's peak/latch anchor guard is still stricter or more weakly synchronized than the visible same-rep shallow close proof cluster.

## One-line purpose

Align the final writer's peak/latch anchor guard with already-proven same-rep official shallow close proof, without reopening absurd pass and without broadening pass authority.

## Locked observed truth

### 1. Weird-pass families remain blocked

Current real-device observations still do not show regression to:
- standing still pass,
- seated hold pass,
- weird late pass after failed reps,
- non-squat motion pass,
- early-pass reopen.

Those remain locked and must stay locked.

### 2. Deep standard path remains healthy

Deep / standard squat still passes through the standard completion-owner chain and must remain untouched.

### 3. Real-device shallow failure is now concentrated in one guard class

Recent device traces show two recurring signatures:

#### Signature A — close proof true, anchor truth weak or stale
Visible close-proof fields become true, but the trace still exposes weak anchor state such as:
- `peakLatched = false`,
- `peakLatchedAtIndex = 0`,
- `baselineFrozen = false`,
- then final close remains blocked with `descent_span_too_short`.

#### Signature B — anchor exists, but series-start / weak-span character remains
Later traces show stronger event state such as:
- `baselineFrozen = true`,
- `peakLatched = true`,
- but notes like `peak_anchor_at_series_start`, `descent_weak`, `recovery_tail_weak` still appear,
- and final close still remains blocked with `descent_span_too_short` or `ascent_recovery_span_too_short`.

This means the next PR must not be another broad shallow recovery attempt.
It must specifically align the final writer's anchor guard with official shallow close truth.

## Critical law (unchanged)

This PR does **not** change authority law.

The final-pass opener remains:

```text
completionTruthPassed
AND completionOwnerPassed
AND completionOwnerReason !== 'not_confirmed'
AND completionBlockedReason == null
AND cycleComplete
AND UI / progression gate clear
AND block-only vetoes clear
=> finalPassEligible / finalPassGranted / finalPassLatched may be true
```

Nothing in this PR may weaken, bypass, or replace that law.

## Scope

In scope:
- `src/lib/camera/squat/squat-completion-canonical.ts`
- `src/lib/camera/squat-completion-state.ts` only if writer anchor truth must be passed through
- optional tiny helper extraction directly supporting anchor-guard alignment at the writer boundary
- focused peak/latch anchor guard smokes only

Expected scope themes:
- peak/latch anchor guard alignment
- same-rep anchor truth synchronization
- final writer anchor acceptance for official shallow close
- preservation of diagnostic truth

Out of scope:
- no authority-law rewiring
- no `auto-progression.ts` opener redesign
- no P3 registry changes
- no pass-core reopening
- no UI latch redesign
- no deep / standard tuning
- no broad threshold sweep
- no non-squat work
- no broad setup/readiness redesign
- no generic admission redesign

## Required design rules

### Rule 1 — Final writer remains completion-owner canonical

Recovered shallow success must still occur only by making canonical completion-owner truth satisfied.
No assist layer, pass-core, latch path, or blocker registry may open pass directly.

### Rule 2 — Same-rep close proof remains necessary

Anchor-guard alignment may recover close only when the same rep already proves:
- admitted official shallow path,
- descend confirmed,
- reversal confirmed after descend,
- recovery confirmed after reversal,
- official shallow reversal satisfied,
- official shallow ascent-equivalent satisfied,
- official shallow closure proof satisfied,
- temporal order integrity,
- no setup contamination,
- no stale / mixed-rep contamination.

If any of those are missing, the rep must remain blocked.

### Rule 3 — This PR aligns anchor truth; it does not relax global timing law

This is **not** a generic span-threshold relaxation PR.
It is an anchor-guard alignment PR.
The goal is not "make shallow easier".
The goal is:

**when same-rep official shallow close proof is already complete, the final writer's peak/latch anchor guard must not independently reject that rep because of stale, unsynchronized, or mis-positioned anchor truth.**

### Rule 4 — Fix the guard, not the symptom

Do not paper over the problem by merely clearing `descent_span_too_short` / `ascent_recovery_span_too_short` later.
The fix must align the writer's underlying anchor acceptance logic itself.

### Rule 5 — Weird-pass families remain hard-locked

The following must remain blocked:
- standing still
- seated hold / still seated
- setup-motion contaminated
- stale prior rep reuse
- mixed-rep contamination
- no real descent
- no real reversal
- no real recovery
- too-fast / early pass
- non-squat motion accidentally opening squat pass
- pass-core-only adversarial probes

### Rule 6 — Deep standard path must remain untouched

Deep and standard squat success is already healthy and must not be retuned.

## Exact target behavior

### This PR must make the following pass

A shallow squat should pass when all are true:
- ready state is stable,
- attempt starts after ready,
- official shallow path is admitted,
- same rep shows meaningful downward commitment,
- same rep shows descend,
- same rep shows reversal after descend,
- same rep shows recovery after reversal,
- official shallow reversal / ascent-equivalent / closure proof are all satisfied,
- temporal order is satisfied,
- no contamination family is present,
- writer anchor truth is same-rep truthful and aligned with the admitted shallow rep.

### This PR must keep the following blocked

A shallow squat must still fail when any of these hold:
- no same-rep attempt start,
- no same-rep descend,
- no same-rep reversal,
- no same-rep recovery,
- sitting without recovery,
- standing without real rep,
- setup contamination,
- stale or mixed-rep contamination,
- early-pass shortcut,
- completion-owner truth not satisfied.

## Suggested technical direction

### Direction A — identify the exact peak/latch conjunct in writer eligibility

Locate the exact conjunct(s) in the writer eligibility path that currently map to:
- `peak_latch_anchor_guard_failed`
- or equivalent writer rejection when official shallow close proof is already complete.

Determine whether the failure is caused by:
- `peakLatched` false,
- `peakLatchedAtIndex` null / 0 / stale,
- series-start anchor reuse,
- anchor position misaligned to the current admitted rep,
- baseline-frozen / peak-latched synchronization drift.

### Direction B — align anchor truth to official shallow close truth

The writer may accept shallow close only when anchor truth comes from the same official shallow rep.

Allowed fixes include:
- synchronizing `peakLatched` / `peakLatchedAtIndex` with the same-rep shallow stream bridge when the rep is already officially admitted and closure-proof-complete,
- rejecting stale or series-start anchor positions that do not belong to the current admitted shallow rep,
- deriving writer anchor truth from the same canonical rep boundary already used by the official shallow contract.

Forbidden fixes include:
- generic threshold reduction,
- clearing timing blockers without fixing anchor provenance,
- letting anchorless reps pass.

### Direction C — preserve diagnostic truth

If anchor alignment changes final writer behavior, preserve enough diagnostics to show:
- why the shallow rep passed,
- that it passed through official shallow close ownership,
- that the anchor was same-rep truthful,
- that weird-pass blockers were not bypassed.

## Required proof posture

Add:
- `scripts/camera-pr-shallow-peak-latch-anchor-guard-align-01-smoke.mjs`

This smoke must prove:
- meaningful shallow same-rep reps pass,
- admitted shallow reps no longer die solely because of anchor misalignment,
- weird-pass negatives remain blocked,
- stale/series-start anchor cannot be reused as current-rep truth,
- deep standard remains standard path.

Also add it to PR-F proof gate as mandatory. No skip expansion.

## Acceptance criteria

- meaningful shallow passes 10/10 when performed consistently,
- weird-pass families remain blocked,
- no `completionTruthPassed = false` / `finalPassGranted = true`,
- no pass-core reopening,
- no registry grant path,
- deep standard stays green,
- recovered shallow success is explainable through authoritative official shallow close ownership with same-rep anchor truth.

## One-line lock

Recover shallow squat only by aligning the final writer's peak/latch anchor guard with same-rep official shallow close proof, while keeping all weird-pass reopeners permanently blocked.