# PR-CAM-CANONICAL-SHALLOW-CONTRACT-01

Date: 2026-04-01  
Base: `main`  
Type: structural / SSOT alignment  
Priority: P0

## Why canonical shallow contract is needed

Event promotion was downgraded from success ownership ([PR-CAM-EVENT-OWNER-DOWNGRADE-01](./PR-CAM-EVENT-OWNER-DOWNGRADE-01.md)), but **shallow closure truth** is still spread across admission flags, owner reversal/recovery, stream bridge, proof bundles, trajectory bridge observability, tickets, and rule `completionBlockedReason`. JSON then shows **split-brain**: shallow admission holds, provenance/recovery signals look strong, yet `completionPassReason` stays `not_confirmed` and `completionBlockedReason` stays `no_reversal` (or the inverse mismatch).

A **canonical shallow completion contract** does not replace the completion owner in this PR. It **aggregates the same facts the pipeline already computed** into one object so observability can answer: which layer (admission / attempt / reversal evidence / recovery evidence / anti–false-pass) is false, and whether `officialShallowPathClosed` disagrees with the canonical predicate bundle.

## What this PR adds

| Area | Change |
|------|--------|
| `src/lib/camera/squat/shallow-completion-contract.ts` | New module: `CanonicalShallowCompletionContract*` types, `deriveCanonicalShallowCompletionContract`, `CANONICAL_SHALLOW_OWNER_FLOOR` (must match `STANDARD_OWNER_FLOOR` = 0.4 in `squat-completion-state.ts`). |
| `src/lib/camera/squat-completion-state.ts` | `SquatCompletionState` fields `canonicalShallowContract*`; one call to `deriveCanonicalShallowCompletionContract` at the **tail** of `evaluateSquatCompletionState`, merged into the object passed to `attachShallowTruthObservabilityAlign01`. **No overwrite** of `completionSatisfied`, `completionPassReason`, or `completionBlockedReason`. |
| `src/lib/camera/auto-progression.ts` | `SquatCycleDebug` pass-through fields for the same contract; **no** change to final pass / retry / fail gates. |
| `docs/pr/PR-CAM-CANONICAL-SHALLOW-CONTRACT-01.md` | This note. |

Resolver rules follow the PR spec: admission and attempt (same bundle for now), reversal evidence from owner OR official shallow proof axes, recovery from owner recovery OR `standingFinalizeSatisfied`, anti–false-pass from setup motion, peak index ≠ 0, and evidence label ≠ `insufficient_signal`. **Split-brain** includes provenance-only reversal, `standing_recovered` + `no_reversal`, and **closure flag vs canonical `satisfied` mismatch** when admitted and in shallow zone.

## What this PR intentionally does NOT change

- **Direct closers** — `mergeShallowTrajectoryAuthoritativeBridge`, `applyUltraLowPolicyLock`, shallow ticket / bridge / core completion paths: **unchanged** in behavior.
- **Thresholds**, reversal/event finalize numeric policy, pass confirmation, HMM assist internals.
- **Files** outside the locked list: `squat-event-cycle.ts`, `squat-reversal-confirmation.ts`, `squat-progression-contract.ts`, etc.

Event-cycle / trajectory rescue / tail backfill / HMM remain **evidence / provenance / candidates**, not new success owners in this PR.

## Files changed

- `src/lib/camera/squat/shallow-completion-contract.ts` (new)
- `src/lib/camera/squat-completion-state.ts`
- `src/lib/camera/auto-progression.ts`
- `docs/pr/PR-CAM-CANONICAL-SHALLOW-CONTRACT-01.md`

## Verification

- `deriveCanonicalShallowCompletionContract` is invoked **once**, only from `evaluateSquatCompletionState` immediately before `attachShallowTruthObservabilityAlign01`.
- `grep`: no `deriveCanonicalShallowCompletionContract` in `auto-progression.ts` (read / pass-through only).
- Completion fields are not assigned from the contract in this PR.
- TypeScript: no import/type errors on the touched files.

## Known follow-up (PR-B: direct closer removal)

- Route shallow authoritative closure through the canonical contract (or a single ticket) as the **only** writer of `completionSatisfied` / pass reason for official shallow success.
- Remove or fold redundant closers (e.g. bridge merge path) once contract-driven closure is proven safe.
- Align `truthMismatch_*` with `canonicalShallowContractSplitBrainDetected` to avoid duplicate mental models.
