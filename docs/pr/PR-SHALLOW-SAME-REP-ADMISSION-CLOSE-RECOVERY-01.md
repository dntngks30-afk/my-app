# PR-SHALLOW-SAME-REP-ADMISSION-CLOSE-RECOVERY-01

Parent SSOT: `docs/SSOT_SQUAT_COMPLETION_FIRST_QUALITY_STRICT_2026_04.md`
Parent Truth Map: `docs/pr/PR-SQUAT-COMPLETION-FIRST-QUALITY-STRICT-TRUTH-MAP-01.md`
Depends on:
- `docs/pr/PR-01-SQUAT-COMPLETION-FIRST-AUTHORITY-FREEZE.md`
- `docs/pr/P1-SQUAT-LEGITIMATE-SHALLOW-EVIDENCE-RECOVERY.md`
- `docs/pr/PR-CAM-SQUAT-AUTHORITY-LAW-RESOLUTION.md`
- `docs/pr/P3-SQUAT-ABSURD-PASS-REGISTRY-NORMALIZATION.md`
- `docs/pr/P2-SQUAT-AUTHORITY-NAMING-COMMENT-CLEANUP.md`

## Working summary

The squat camera axis is now structurally hardened in four important ways:

1. completion-owner truth remains the only final-pass opener;
2. absurd-pass reopeners (standing, seated, stale, setup-contaminated, mixed-rep, early-pass families) remain blocked;
3. late false-pass blockers are normalized into an explicit block-only registry;
4. wording / comments / trace-facing docs now truthfully describe the landed completion-first model.

Real-device truth after those landings is now narrower and clearer:

- weird passes are not the main problem anymore;
- deep squat passes cleanly;
- legitimate shallow squat still fails;
- the failure is not an opener-law failure or a blocker-registry failure;
- the failure sits inside the official shallow same-rep admission + close chain.

This PR is the narrow recovery PR for that remaining residual risk.

## One-line purpose

Recover legitimate shallow squat success by narrowly restoring same-rep shallow admission and same-rep shallow close, without reopening absurd pass, without broadening pass authority, and without changing any non-shallow success path.

## Locked observed truth

### 1. Weird-pass families are currently locked

The currently observed real-device state is no longer:
- standing still passing;
- seated hold passing;
- several failed attempts later passing incorrectly;
- non-squat motion accidentally opening squat final pass;
- early-pass reopening.

Those regressions are considered locked and must remain locked.

### 2. Deep squat is healthy

Deep standard squat completes through the standard completion-owner chain and passes normally.

### 3. Shallow failure now splits into two narrow residuals

#### Residual A — shallow admission failure

Some legitimate shallow attempts show shallow-band depth and attempt-like motion, but still die before official shallow contract admission, typically with:
- `completionBlockedReason = not_armed`
- `freeze_or_latch_missing`
- `baselineFrozen = false`
- `peakLatched = false`

This means the system sees shallow intent but does not always open the authoritative shallow contract entry conditions on real device.

#### Residual B — shallow close failure

Other legitimate shallow attempts do enter official shallow contract and recover meaningful same-rep reversal / ascent-equivalent / closure-proof signals, but still die at final shallow close with:
- `completionBlockedReason = descent_span_too_short`
- sometimes `ascent_recovery_span_too_short`
- `officialShallowPathClosed = false`
- final result `completionTruthPassed = false`

This means the system sometimes forms enough same-rep shallow close evidence to be product-legitimate, but still fails the standing-finalize side of the shallow contract.

## Critical law (unchanged)

This PR does **not** change the authority law.

The final-pass opener law remains:

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

Nothing in this PR may weaken or bypass that law.

## Core diagnosis

The remaining shallow failure is no longer a broad semantics problem.
It is a **same-rep shallow contract formation problem** inside the canonical completion-state owner path.

Concretely:

1. some legitimate shallow reps do not get admitted into the official shallow contract early enough because admission still over-relies on freeze / latch completeness on device;
2. some legitimate shallow reps that already satisfy same-rep reversal / ascent-equivalent / closure-proof still die at shallow close because standing-finalize constraints remain too strict for real-device shallow ROM.

Therefore the next PR must be:
- a shallow contract recovery PR;
- not an opener rewrite;
- not a blocker weakening PR;
- not a registry PR;
- not a threshold-broadening sweep.

## Scope

In scope:
- `src/lib/camera/squat-completion-state.ts`
- `src/lib/camera/evaluators/squat.ts` pass-through only if needed
- optional narrow helper extraction directly supporting shallow admission / shallow close inside completion-state ownership
- focused shallow real-device recovery smokes only

Expected scope themes:
- same-rep shallow admission recovery
- same-rep shallow close recovery
- official shallow contract truthful closure recovery
- no-op pass-through of new diagnostic fields if strictly required for smoke / proof

Out of scope:
- no authority-law rewiring
- no final-pass surface redesign
- no pass-core shortcut reopening
- no block-only registry changes
- no UI latch redesign
- no deep / standard path tuning
- no cross-movement work
- no setup/readiness redesign outside narrow same-rep shallow contract needs

## Required design rules

### Rule 1 — Recovery must stay completion-owner canonical

A recovered shallow pass must still end by making canonical completion-owner truth satisfied.
It must not pass because pass-core, assist, UI latch, or registry directly opens pass.

### Rule 2 — Recovery must be same-rep truthful

The PR may only recover shallow success when all required evidence belongs to the same rep.
It must not mix:
- prior rep peak,
- later rep reversal,
- later rep recovery,
- stale pass-core,
- mixed-rep timestamps.

### Rule 3 — Admission recovery is allowed; shortcut reopening is forbidden

The PR may make official shallow admission more truthful for real-device shallow reps when the same rep clearly shows:
- ready-state start,
- meaningful downward commitment,
- shallow-band depth,
- same-rep descend evidence,
- no setup contamination,
- no stale / mixed-rep contamination.

The PR may not reopen pass because freeze/latch was missing but no same-rep shallow rep truly existed.

### Rule 4 — Close recovery is allowed only after same-rep closure proof already exists

The PR may recover close from `descent_span_too_short` / `ascent_recovery_span_too_short` only when same-rep shallow close proof is already present, including:
- admitted official shallow path,
- descend confirmed,
- reversal confirmed after descend,
- recovery confirmed after reversal,
- official shallow reversal satisfied,
- official shallow ascent-equivalent satisfied,
- official shallow closure-proof satisfied,
- no setup contamination,
- no stale / mixed-rep contamination.

If those are not present, the rep must remain blocked.

### Rule 5 — Weird-pass families must remain hard-locked

The following must remain blocked after this PR:
- standing still
- seated hold / still seated
- setup-motion contaminated
- stale prior rep reuse
- mixed-rep contamination
- no real descent
- no real reversal
- no real recovery
- early-pass / too-fast pass
- non-squat motion accidentally opening squat pass

### Rule 6 — Deep standard path must remain untouched

Deep and standard squat success is already healthy and must not be retuned.

## Exact target behavior

### This PR must make the following pass

A shallow squat should pass when all are true:
- ready state is stable;
- attempt starts after ready;
- same rep shows meaningful downward commitment;
- same rep enters shallow-band / ultra-low-ROM depth truth;
- same rep shows reversal or ascent-equivalent after descend;
- same rep shows recovery after reversal;
- official shallow contract is admitted;
- official shallow closure proof is satisfied;
- no contamination / stale / setup blocker family is present.

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

### Direction A — narrow admission recovery

Inside `squat-completion-state.ts`, recover official shallow admission for real-device shallow reps that currently die as `not_armed` / `freeze_or_latch_missing`, but only when same-rep shallow evidence is already strong enough.

This is an admission recovery, not a pass recovery.
It may let the rep enter the official shallow contract.
It may not directly mark the rep as completed.

### Direction B — narrow standing-finalize close recovery

Inside `squat-completion-state.ts`, recover close from `descent_span_too_short` / `ascent_recovery_span_too_short` only when same-rep shallow close proof is already present.

This is not a global span-threshold relaxation.
It is a narrow same-rep shallow close completion rule.

## Acceptance criteria

1. Legitimate shallow squat passes on device repeatedly and cleanly.
2. The target acceptance bar is effectively: meaningful shallow reps pass 10/10 when performed consistently.
3. No weird-pass family regresses open.
4. No `completionTruthPassed = false` / `finalPassGranted = true` illegal state reappears.
5. No pass-core reopening occurs.
6. No P3 registry path becomes a grant path.
7. Deep standard squat remains green.
8. Recovered shallow success is explainable through official shallow contract + completion-owner truth, not through assist shortcut behavior.

## Required proof / smoke posture

This PR must add a new focused smoke dedicated to same-rep shallow admission + close recovery.

Suggested file:
- `scripts/camera-pr-shallow-same-rep-admission-close-recovery-01-smoke.mjs`

The smoke must prove all of the following:

### Must-pass group
- repeated meaningful shallow same-rep reps pass;
- admitted shallow rep with reversal/recovery/closure-proof no longer dies purely on `descent_span_too_short`;
- admission can recover from current `not_armed` / `freeze_or_latch_missing` real-device-like shallow traces when same-rep shallow evidence is sufficient.

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

### Proof-gate requirement
This smoke must be added to the PR-F proof bundle as a mandatory script.
No conditional skip expansion is allowed.

## Residual risk policy

If shallow still fails after best-effort same-rep admission + close recovery, do **not** broaden into:
- authority rollback,
- pass-core reopening,
- registry weakening,
- generic threshold sweeps.

Instead document the exact remaining same-rep evidence gap.

## One-line lock

Recover shallow squat only by restoring same-rep official shallow admission and same-rep official shallow close inside canonical completion-owner truth, while keeping all weird-pass reopeners permanently blocked.