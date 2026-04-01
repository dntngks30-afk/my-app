# PR-SHALLOW-ULTRA-LOW-POLICY-LOCK-01

Date: 2026-04-01  
Reads: `docs/SHALLOW_SQUAT_TRUTH_SSOT_2026_04_01.md` §PR-3, `docs/SHALLOW_SQUAT_PR_PROMPTS_2026_04_01.md` §PR-3, PR-1/PR-2 PR notes

## Working summary

- **PR-3 is a policy lock PR** — ultra-low ROM remains non-passable; we only stamp **authoritative** policy-blocked outcomes at the correct **late** stage.
- **Not** a threshold PR, **not** standing-finalize redesign, **not** event-promotion internals redesign.
- **Product truth preserved:** ultra-low does **not** close successfully; no new success path.
- **Observation-layer** reversal/recovery (timeline heuristics), **provenance-only** rescues, and **event-cycle** detection are **not** policy owners.

## Files changed

| File | Role |
|------|------|
| `src/lib/camera/squat-completion-state.ts` | `isUltraLowPolicyScope`, `isUltraLowPolicyDecisionReady`, `applyUltraLowPolicyLock`; runs inside `attachShallowTruthObservabilityAlign01` before PR-1/PR-2 attach |
| `src/lib/camera/evaluators/squat.ts` | `highlightedMetrics` pass-through for policy fields |
| `src/lib/camera/auto-progression.ts` | `SquatCycleDebug` + pass-through from `squatCompletionState` |
| `docs/pr/PR-SHALLOW-ULTRA-LOW-POLICY-LOCK-01.md` | This document |

## New policy fields (exact names)

| Field | Meaning |
|-------|---------|
| `ultraLowPolicyScope` | `evidenceLabel === 'ultra_low_rom'` **and** `officialShallowPathCandidate === true` (authoritative shallow relevance) |
| `ultraLowPolicyDecisionReady` | All readiness conditions below are true |
| `ultraLowPolicyBlocked` | Lock applied: `completionBlockedReason` forced to `ultra_low_rom_not_allowed` |
| `ultraLowPolicyTrace` | Compact trace, e.g. `scope=0|1`, `ready=0|1`, optional `blocked=policy` |

## Policy decision readiness (exact rule)

All must hold:

1. In ultra-low policy scope (`ultraLowPolicyScope`).
2. `officialShallowPathCandidate === true`.
3. `officialShallowPathAdmitted === true`.
4. **Authoritative** reversal: `reversalConfirmedAfterDescend === true`.
5. **Authoritative** recovery: `recoveryConfirmedAfterReversal === true`.
6. **Standing finalize truth** (same strings as event-promotion `finalizeOk`, no new heuristic):  
   `standingRecoveryFinalizeReason` is one of `standing_hold_met` | `low_rom_guarded_finalize` | `ultra_low_rom_guarded_finalize`.
7. Normalized blocker family from **current** `completionBlockedReason` + `completionSatisfied` is **not** `admission` and **not** `reversal` (uses existing `mapCompletionBlockedReasonToShallowNormalizedBlockerFamily`).

If readiness is **false**, the existing blocker and PR-1/PR-2 classification are unchanged by PR-3.

If readiness is **true**:

- `completionBlockedReason` → `ultra_low_rom_not_allowed`
- `completionSatisfied` → `false`
- `completionPassReason` → `not_confirmed`
- `shallowNormalizedBlockerFamily` → `policy`
- `shallowAuthoritativeContractStatus` → `policy_blocked` (via existing PR-2 mapper)
- Event-promotion success that would have closed ultra-low is **undone** at the output layer (`eventCyclePromoted` cleared, `completionFinalizeMode` demoted from `event_promoted_finalized` to `blocked` when applicable).

## Why top-level reversal/recovery is insufficient

PR-1 already exposes `shallowObservationLayerReversalTruth` vs `shallowAuthoritativeReversalTruth`. Ultra-low attempts can show timeline “reversal” while **owner** `reversalConfirmedAfterDescend` stays false. PR-3 readiness uses **only** authoritative flags.

## Why provenance is insufficient

`trajectoryReversalRescueApplied`, tail/stream-bridge/ultra-shallow rescues, `reversalConfirmedBy === 'trajectory'` remain **provenance-only** (PR-1 `shallowProvenanceOnlyReversalEvidence`). They are **not** inputs to `isUltraLowPolicyDecisionReady`.

## Why event-cycle is insufficient

`squatEventCycle` / notes / `eventCycleDetected` are not referenced in readiness. Event promotion may still run inside `evaluateSquatCompletionState`; PR-3 may **override** the returned success **after** that path, without editing promotion internals.

## What remained unchanged

- Thresholds, numeric constants, arming, pose phases, `computeBlockedAfterCommitment`, reversal detector, event-cycle detector, standing finalize gate **internals**, UI latch.
- Low-ROM and standard paths (scope requires `evidenceLabel === 'ultra_low_rom'`).
- Non-ultra attempts including `setupMotionBlocked` / deeper ROM (not in ultra-low scope).

## Verification notes

- Typecheck / lint on allowed files.
- JSON: when authoritative reversal/recovery/finalize are satisfied and family is not admission/reversal, expect `ultraLowPolicyBlocked`, `completionBlockedReason === 'ultra_low_rom_not_allowed'`, `shallowNormalizedBlockerFamily === 'policy'`.
- When `no_reversal` or admission family applies, `ultraLowPolicyDecisionReady` should be false and earlier blockers preserved.
