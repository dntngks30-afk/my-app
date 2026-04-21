# PR-SHALLOW-ADMITTED-TO-CLOSED-CONTRACT-ALIGN-01

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

## One-line purpose
Align the official shallow completion contract so that an already admitted same-rep shallow cycle can truthfully transition from `admitted` to `closed`, without reopening absurd pass and without changing the completion-owner opener law.

## Locked observed truth

### 1. Weird-pass families remain blocked
Standing still, seated hold, setup contamination, stale prior rep, mixed-rep contamination, early-pass, and pass-core-only adversarial cases remain blocked.

### 2. Deep standard path remains healthy
Deep / standard squat still passes through `standard_cycle` and must remain untouched.

### 3. Admitted shallow repeatedly fails to become closed
Recent real-device shallow traces repeatedly show:
- `officialShallowPathAdmitted = true`
- `officialShallowPathClosed = false`
- `completionBlockedReason` dominated by `descent_span_too_short` and `no_reversal`
- in some later windows, `officialShallowStreamBridgeApplied = true`, `officialShallowAscentEquivalentSatisfied = true`, `officialShallowClosureProofSatisfied = true`, `officialShallowReversalSatisfied = true`
- and even with `baselineFrozen = true` and `peakLatched = true` in later windows, the path still remains blocked and never closes.

This means the dominant residual is no longer "cannot observe shallow" and no longer only "writer anchor mismatch".
The dominant residual is:

**the admitted shallow contract still fails to satisfy the upstream close law that decides whether the official shallow path may become closed.**

## Critical law (unchanged)
The final-pass opener remains completion-owner only.
Nothing in this PR may weaken, bypass, or replace that law.

## Core diagnosis
The current runtime contract for admitted shallow reps is structurally inconsistent:
- the system can admit a shallow rep,
- can sometimes prove same-rep shallow bridge / ascent-equivalent / closure-proof,
- can sometimes even have frozen baseline and latched peak,
- but still keeps the official shallow path blocked by upstream close blockers such as `descent_span_too_short` or `no_reversal`.

Therefore the next PR must align the **admitted-to-closed shallow contract itself**.
It must not be another writer-only patch.
It must not be a broad threshold sweep.
It must not reopen weird-pass families.

## Scope
In scope:
- `src/lib/camera/squat-completion-state.ts`
- `src/lib/camera/squat/squat-completion-canonical.ts` only if needed to keep the contract/writer boundary truthful after upstream close alignment
- optional tiny helper extraction directly supporting admitted-to-closed shallow contract alignment
- focused admitted-to-closed shallow contract smokes only

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

### Rule 2 — Admission is not enough
`officialShallowPathAdmitted = true` alone must never pass.
The rep may close only when same-rep close truth is genuinely present.

### Rule 3 — The contract must define a truthful admitted-to-closed path
For an admitted shallow rep, the contract must explicitly determine when the rep may advance to `officialShallowPathClosed = true`.
That close law must be based on same-rep shallow truth, not on stale or standard-cycle assumptions that were appropriate before admission.

### Rule 4 — Fix the shallow close contract, not isolated symptoms
Do not patch this by merely clearing blocked reasons later.
Do not patch this by another writer-only exception.
The admitted-to-closed shallow contract itself must become internally coherent.

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
- same-rep reversal and recovery truth are genuinely established, either through the official shallow stream bridge or the canonical shallow close law
- no setup contamination
- no stale / mixed-rep contamination
- the admitted shallow contract truthfully transitions to `officialShallowPathClosed = true`
- canonical completion-owner truth then becomes satisfied

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
### Direction A — isolate the admitted-to-closed veto layer
Inside `squat-completion-state.ts`, isolate the exact branch or conjuncts that prevent an already admitted shallow rep from becoming `closed`.
Expected dominant vetoes are:
- `descent_span_too_short`
- `no_reversal`
- possibly `no_standing_recovery`
when they are still being evaluated under assumptions that do not match the official shallow contract.

### Direction B — make close law official-shallow-specific after admission
Once a rep is already admitted to the official shallow path, the close law must use the same-rep shallow contract truth.
It must not continue to require a stricter standard-like descent/reversal interpretation than the official shallow path itself already allows.

### Direction C — preserve truthful diagnostics
If contract alignment changes close behavior, preserve enough diagnostics to show:
- why the rep closed
- which shallow truth path closed it
- that weird-pass blockers were not bypassed

## Required proof posture
Add:
- `scripts/camera-pr-shallow-admitted-to-closed-contract-align-01-smoke.mjs`

This smoke must prove:
- admitted shallow reps with genuine same-rep shallow close truth now close and pass
- admitted shallow reps without genuine same-rep reversal/recovery still fail
- weird-pass negatives remain blocked
- deep standard remains standard path

Also add it to PR-F proof gate as mandatory. No skip expansion.

## Acceptance criteria
- meaningful shallow passes 10/10 when performed consistently on current head or equivalent device truth
- admitted shallow no longer stalls indefinitely at `closed = false` when same-rep close truth is genuinely present
- weird-pass families remain blocked
- no `completionTruthPassed = false` / `finalPassGranted = true`
- no pass-core reopening
- no registry grant path
- deep standard stays green

## One-line lock
Recover shallow squat only by aligning the official shallow admitted-to-closed contract with same-rep shallow close truth, while keeping all weird-pass reopeners permanently blocked.