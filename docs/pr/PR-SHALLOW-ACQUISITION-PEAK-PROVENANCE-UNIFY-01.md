# PR-SHALLOW-ACQUISITION-PEAK-PROVENANCE-UNIFY-01

## Parent SSOT
- `docs/pr/PR-SHALLOW-OWNER-SPLIT-TRUTH-MAP-01.md`

## Purpose
This child PR addresses only the first structural group of shallow failures:
- Lane A — pre-attempt acquisition collapse
- Lane B — admitted/completion truth vs peak-owner truth split
- Lane E — peak-anchor provenance drift

This PR exists to unify the read boundary for:
- shallow candidate -> current rep acquisition
- baseline freeze provenance
- peak latch provenance
- committed/current-rep ownership

This PR is not allowed to solve terminal blocker policy, same-rep reset contamination, or global threshold issues.

## Exact failure shape in scope

### In-scope shape 1
A real shallow rep shows:
- shallow candidate evidence
- descend signal
- downward commitment
but still remains:
- `attemptStarted=false`
- `completionBlockedReason=not_armed`
- `baselineFrozen=false`
- `peakLatched=false`

### In-scope shape 2
A real shallow rep later shows:
- `attemptStarted=true`
- `officialShallowPathAdmitted=true`
- possibly even closure/reversal proof on completion-side
but peak/owner-side truth still behaves as if the rep has no valid current peak provenance.

### In-scope shape 3
A rep uses stale or mis-originated peak provenance:
- `peakLatchedAtIndex=0`
- series-start-like anchor drift
- `peak_anchor_at_series_start` or equivalent provenance notes

## Why this PR exists
Repeated shallow work has shown that the system can partially see the same rep in one layer and not in another. That produces unstable blocker stories and makes later terminal debugging meaningless.

Before touching terminal blockers, the repo must first ensure that acquisition owner and peak provenance owner are talking about the same rep.

## Allowed scope
This PR may modify only the narrowest boundary needed for:
- current-rep shallow acquisition
- attemptStarted elevation for legitimate shallow reps
- baseline freeze provenance
- peak latch provenance
- committed/current-rep provenance alignment
- prevention of stale/series-start peak anchoring for same-rep shallow logic

## Explicit non-goals
This PR must **not**:
- relax global span thresholds
- relax global reversal thresholds
- relax global standing recovery thresholds
- change completion terminal blocker policy
- change pass-core ownership law
- change registry semantics
- change UI latch semantics
- change deep/standard semantics
- solve setup/tail contamination
- solve same-rep reset boundary bugs
- add shortcut pass paths

## Core implementation law
Do not think "make shallow pass easier".
Think:

> make the same real shallow rep acquire and retain the correct current-rep and peak provenance across owner layers.

## Design constraints

### Constraint 1
If completion-side truth admits the rep, peak provenance may not still rely on stale series-start ownership.

### Constraint 2
If current-rep acquisition opens, the peak/anchor provenance must be derived from the same shallow rep epoch, not from unrelated earlier frames.

### Constraint 3
If a shallow rep is still pre-attempt, the system must fail for acquisition reasons only; it must not silently consume stale peak provenance.

### Constraint 4
No negative control weakening is allowed while improving acquisition/peak provenance.

## Likely narrow boundaries to inspect
- shallow candidate -> attemptStarted transition
- baseline freeze creation / invalidation boundary
- peak latch creation / invalidation boundary
- committedAtMs / peakAtMs provenance source
- same-rep peak anchor selection logic
- any helper that allows series-start or stale prefix ownership to leak into current shallow rep evaluation

## Required proof bundles

### Mandatory in-scope bundles
- latest shallow traces that still show Lane A behavior
- latest shallow traces that show admission on one layer but missing/invalid peak provenance on another
- latest shallow traces that show `peakLatchedAtIndex=0` or `peak_anchor_at_series_start` style drift

### Mandatory guards
- standing negatives remain blocked
- seated negatives remain blocked
- deep standard passes remain intact

### Out-of-scope but must not regress
- terminal owner split behavior
- same-rep reset/setup contamination behavior

## Acceptance criteria

### Must improve
At least one of the following must become more coherent on the latest replay traces, without broadening thresholds:
- `attemptStarted`
- `baselineFrozen`
- `peakLatched`
- `peakLatchedAtIndex` provenance
- `committedAtMs` / `peakAtMs` same-rep alignment
- agreement between completion-side admission and peak-owner-side rep ownership

### Must not regress
- standing negative remains blocked
- seated negative remains blocked
- deep standard path remains unchanged
- pass-core / authority / registry / UI latch semantics remain unchanged
- terminal blocker policy remains unchanged

### Explicit failure conditions
- threshold relaxation is used to fake improvement
- stale peak provenance still leaks from series start
- admitted rep and peak-owner rep still disagree in the same trace
- implementation quietly drifts into terminal blocker policy or reset-boundary policy

## Final lock sentence
This PR is not a shallow-pass PR.
It is an acquisition and peak-provenance unification PR.
Its job is to ensure that when a real shallow rep exists, acquisition owner and peak-owner read the same rep epoch with the same provenance.
