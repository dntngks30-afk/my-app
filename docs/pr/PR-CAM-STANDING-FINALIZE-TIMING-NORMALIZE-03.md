# PR-CAM-STANDING-FINALIZE-TIMING-NORMALIZE-03

Date: 2026-04-01  
Base: `main`

## Symptom

Deep valid squats could show very large `standingRecoveryHoldMs` (e.g. ~2.3s) in JSON even though finalize minima (`MIN_STANDING_RECOVERY_HOLD_MS`, frame count) are small. The metric was **full contiguous tail dwell** after return-to-standing, not the **shortest sub-window** that actually satisfies the finalize rule—so traces implied the user “had to stand” for the whole tail.

Late `setup_motion:*` could still overwrite `completionSatisfied` after the motion had already reached **authoritative** standing recovery, delaying or distorting closure.

## What changed

### 1) Standard-band hold reporting (`squat-completion-state.ts`)

When `standingRecoveryFinalizeBand === 'standard'` and finalize is already satisfied, `standingRecoveryHoldMs` and `standingRecoveryFrameCount` exported on `SquatCompletionState` are taken from **`computeMinimalQualifyingStandingTailHold`**: within the post-peak standing suffix ending at the last frame, the **shortest** suffix that still meets the **existing** `minFramesUsed` / `minHoldMsUsed` from `getStandingRecoveryFinalizeGate`.

- **No** change to `MIN_STANDING_RECOVERY_*`, low-ROM finalize constants, reversal, event-cycle, or shallow ROM thresholds.
- Finalize **decision** still uses the original `getStandingRecoveryWindow` + `getStandingRecoveryFinalizeGate` inputs.

### 2) Observability

- `standingFinalizeSatisfied` — mirrors finalize satisfied at end of core evaluation.
- `standingFinalizeReadyAtMs` — `recoveredAtMs + holdMs` for the minimal qualifying tail (standard + satisfied only).
- `standingFinalizeSuppressedByLateSetup` — set in the squat **evaluator**: `true` when setup motion still strips an otherwise satisfied completion; `false` when bypass applies.

### 3) Late setup bypass (`evaluators/squat.ts`)

If completion is already satisfied but `setup_motion` would block, **do not** strip completion when **all** hold:

- `descendConfirmed`, `attemptStarted`
- `ownerAuthoritativeReversalSatisfied`, `ownerAuthoritativeRecoverySatisfied` (PR-2 fields)
- `currentSquatPhase === 'standing_recovered'`

Early setup blocking when the cycle is not closed is unchanged.

## Intentionally not changed

- Event promotion success path (remains off).
- Trajectory / tail / ultra-shallow as authoritative reversal (PR-2 unchanged).
- `squat-reversal-confirmation.ts`, `squat-event-cycle.ts`, `squat-progression-contract.ts`.
- Shallow `no_reversal` still authoritative when reversal proof is missing.

## Files

| File | Role |
|------|------|
| `src/lib/camera/squat-completion-state.ts` | Minimal tail hold helper + standard reporting + finalize observability |
| `src/lib/camera/evaluators/squat.ts` | Late setup bypass + highlightedMetrics |
| `src/lib/camera/auto-progression.ts` | `SquatCycleDebug` pass-through |
| `docs/pr/PR-CAM-STANDING-FINALIZE-TIMING-NORMALIZE-03.md` | This note |

## Why before shallow pass tuning

Normalize **what we measure** and **late UI/setup interference** so shallow authoritative closure work is not confounded by misleading hold numbers or spurious late `setup_motion` overrides.
