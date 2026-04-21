# PR-SHALLOW-AUTHORITATIVE-CLOSE-OWNERSHIP-RECOVERY-01

Parent SSOT: `docs/SSOT_SQUAT_COMPLETION_FIRST_QUALITY_STRICT_2026_04.md`
Parent Truth Map: `docs/pr/PR-SQUAT-COMPLETION-FIRST-QUALITY-STRICT-TRUTH-MAP-01.md`
Depends on:
- `docs/pr/PR-01-SQUAT-COMPLETION-FIRST-AUTHORITY-FREEZE.md`
- `docs/pr/P1-SQUAT-LEGITIMATE-SHALLOW-EVIDENCE-RECOVERY.md`
- `docs/pr/PR-CAM-SQUAT-AUTHORITY-LAW-RESOLUTION.md`
- `docs/pr/P3-SQUAT-ABSURD-PASS-REGISTRY-NORMALIZATION.md`
- `docs/pr/P2-SQUAT-AUTHORITY-NAMING-COMMENT-CLEANUP.md`
- `docs/pr/PR-SHALLOW-SAME-REP-ADMISSION-CLOSE-RECOVERY-01.md`

## Working summary

The prior shallow same-rep recovery direction was correct in philosophy but failed in product acceptance.

Observed real-device truth after that prior recovery attempt:
- weird-pass families remain blocked;
- deep standard squat remains healthy;
- legitimate shallow reps still fail repeatedly;
- the repeated failure is no longer a broad admission-only problem;
- the repeated failure sits at **authoritative shallow close ownership**.

This PR exists because the previous recovery attempt did not make canonical close actually own the final write.

## One-line purpose

Recover legitimate shallow squat by making same-rep official shallow close own the authoritative completion write when closure proof is already complete, without reopening absurd pass and without broadening pass authority.

## Locked observed truth

### 1. Weird-pass families remain blocked

Current real-device logs do **not** show regression to:
- standing still pass,
- seated hold pass,
- weird late pass after failed reps,
- non-squat motion pass,
- early-pass reopen.

Those remain locked and are out of scope for relaxation.

### 2. Deep standard path remains healthy

Deep / standard squat still passes through the standard completion-owner chain and must remain untouched.

### 3. Repeated shallow failure has one dominant signature

Across repeated real-device shallow attempts, the same terminal pattern recurs:
- `officialShallowPathCandidate = true`
- `officialShallowPathAdmitted = true`
- `reversalConfirmedAfterDescend = true`
- `recoveryConfirmedAfterReversal = true`
- `officialShallowStreamBridgeApplied = true`
- `officialShallowAscentEquivalentSatisfied = true`
- `officialShallowClosureProofSatisfied = true`
- `officialShallowReversalSatisfied = true`

but still:
- `officialShallowPathClosed = false`
- `completionBlockedReason = descent_span_too_short`
- `finalPassBlockedReason = completion_truth_not_passed`

This means the remaining blocker is no longer "cannot see shallow".
It is:

**the canonical completion-state owner still writes a blocked close even after same-rep shallow closure proof is already complete.**

### 4. Admission still flickers, but it is no longer the primary residual

Some traces still begin with:
- `not_armed`
- `freeze_or_latch_missing`
- `peak_not_latched`

However those same traces later reach admitted shallow state plus full reversal / recovery / closure-proof.
That means the main unresolved issue is not just admission entry.
The main unresolved issue is that the later authoritative close does not convert that proven shallow rep into a closed official cycle.

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

## Core diagnosis

The previous shallow recovery attempt improved recovery **signals** but did not secure **authoritative close ownership**.

In practice this means one of the following is still true inside canonical completion-state ownership:

1. same-rep shallow close recovery never survives to the final authoritative blocked-reason / pass-reason write; or
2. a later canonical close phase rewrites the recovered shallow state back to `descent_span_too_short`; or
3. close recovery is attached to diagnostics / pre-close state, but not to the single owner path that decides `officialShallowPathClosed`, `completionBlockedReason`, and `completionSatisfied`.

This PR must solve that ownership problem directly.

## Scope

In scope:
- `src/lib/camera/squat-completion-state.ts`
- optional narrow helper extraction directly supporting authoritative shallow close ownership in completion-state
- `src/lib/camera/evaluators/squat.ts` pass-through only if strictly required for proof
- focused shallow ownership smokes only

Expected scope themes:
- authoritative close ownership
- final shallow close write order
- same-rep official shallow cycle closure
- narrow preservation of admission signals only where required by final close ownership

Out of scope:
- no authority-law rewiring
- no `auto-progression.ts` opener redesign
- no final-pass surface redesign
- no pass-core shortcut reopening
- no P3 registry changes
- no blocker weakening sweep
- no UI latch redesign
- no deep / standard path tuning
- no cross-movement work

## Required design rules

### Rule 1 — Close ownership must remain completion-owner canonical

Recovered shallow success must still occur by making canonical completion-owner truth satisfied.
No assist layer, pass-core, latch path, or blocker registry may open pass directly.

### Rule 2 — Same-rep close proof is necessary, not optional

Authoritative shallow close may recover only when the same rep already proves:
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

### Rule 3 — This PR fixes owner write, not broad thresholds

This is **not** a generic span-threshold relaxation PR.
It is an owner-write PR.
The goal is not "make shallow easier".
The goal is:

**when same-rep shallow close proof is already complete, the authoritative owner must write a closed official shallow cycle instead of rewriting the rep back to `descent_span_too_short`.**

### Rule 4 — Admission may only be touched if required to preserve the owner chain

If a tiny admission adjustment is necessary to allow the recovered close path to reach the owner write, it must remain:
- same-rep only,
- ready-state only,
- no setup contamination,
- no stale / mixed-rep contamination,
- no direct success write.

Admission is secondary in this PR.
Authoritative close ownership is primary.

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
- ready state is stable;
- attempt starts after ready;
- official shallow path is admitted;
- same rep shows meaningful downward commitment;
- same rep shows descend;
- same rep shows reversal after descend;
- same rep shows recovery after reversal;
- official shallow reversal / ascent-equivalent / closure proof are all satisfied;
- no contamination family is present.

### This PR must keep the following blocked

A shallow squat must still fail when any of these hold:
- no same-rep attempt start;
- no same-rep descend;
- no same-rep reversal;
- no same-rep recovery;
- sitting without recovery;
- standing without real rep;
- setup contamination;
- stale or mixed-rep contamination;
- early-pass shortcut;
- completion-owner truth not satisfied.

## Suggested technical direction

### Direction A — identify the single authoritative close writer

Inside `squat-completion-state.ts`, identify the exact branch / phase that finally decides:
- `completionSatisfied`
- `completionPassReason`
- `completionBlockedReason`
- `officialShallowPathClosed`
- `officialShallowPathBlockedReason`
- any official shallow cycle success write

Do not fix symptoms before locating that write boundary.

### Direction B — move close recovery to the owner boundary, not before it

If the current recovery runs before a later canonical blocker rewrite, move or integrate the recovery at the final owner-write boundary.

The recovery must decide:
- when same-rep shallow close proof is sufficient to produce a closed official shallow cycle;
- when `descent_span_too_short` / `ascent_recovery_span_too_short` must remain blocked because proof is incomplete.

### Direction C — preserve diagnostic truth

If the owner write changes, preserve enough diagnostics to show:
- why the shallow rep passed;
- that it passed through official shallow close ownership;
- that weird-pass blockers were not bypassed.

## Acceptance criteria

1. Legitimate shallow squat passes on device repeatedly and cleanly.
2. The practical bar is: meaningful shallow reps pass 10/10 when performed consistently.
3. No weird-pass family regresses open.
4. No `completionTruthPassed = false` / `finalPassGranted = true` illegal state reappears.
5. No pass-core reopening occurs.
6. No P3 registry path becomes a grant path.
7. Deep standard squat remains green.
8. Recovered shallow success is explainable through **authoritative official shallow close ownership**, not through assist shortcut behavior.

## Required proof / smoke posture

This PR must add a dedicated focused smoke for authoritative close ownership.

Suggested file:
- `scripts/camera-pr-shallow-authoritative-close-ownership-recovery-01-smoke.mjs`

The smoke must prove all of the following:

### Must-pass group
- repeated meaningful shallow same-rep reps pass;
- admitted shallow rep with full same-rep reversal / recovery / closure-proof no longer dies on `descent_span_too_short`;
- the owner write actually produces `officialShallowPathClosed = true`, `completionSatisfied = true`, and canonical completion-owner pass.

### Must-stay-blocked group
- standing still
- seated hold
- setup contamination
- stale prior rep
- mixed-rep contamination
- no reversal
- no recovery
- early-pass shortcut
- pass-core-only adversarial probe

### Ownership integrity group
- a shallow rep cannot pass merely because diagnostic close-proof fields are true if owner close is not satisfied;
- final owner write cannot silently revert a proven same-rep shallow close back to `descent_span_too_short`;
- deep standard cycle still passes via standard path.

### Proof-gate requirement
This smoke must be added to the PR-F proof bundle as a mandatory script.
No conditional skip expansion is allowed.

## Residual risk policy

If shallow still fails after best-effort owner-write recovery, do **not** broaden into:
- authority rollback,
- pass-core reopening,
- registry weakening,
- generic threshold sweeps.

Instead document the exact remaining owner-write gap.

## One-line lock

Recover shallow squat only by making same-rep official shallow close own the final canonical completion write, while keeping all weird-pass reopeners permanently blocked.