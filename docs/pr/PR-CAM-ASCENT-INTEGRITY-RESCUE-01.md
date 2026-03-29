# PR-CAM-ASCENT-INTEGRITY-RESCUE-01 — Guarded trajectory rescue ascent integrity hardening

## Problem

- On main, after PR-CAM-PEAK-ANCHOR-INTEGRITY-02, `squat-completion-state.ts` still contained `ascendForProgression = computeAscendConfirmed(rf) || true` inside the guarded trajectory rescue branch.
- That expression **auto-granted ascent truth** whenever trajectory rescue supplied a reversal-equivalent anchor (`rf`), even when explicit ascent evidence was weak or absent.
- Intended contract (PR-CAM-31): rescue may provide a **reversal-equivalent anchor**, not **free ascent truth**.

## Scope

- Add exported pure helper `trajectoryRescueMeetsAscentIntegrity` (and `TrajectoryRescueAscentIntegrityArgs`).
- Replace the unconditional `|| true` with: explicit `computeAscendConfirmed(rf)` **or** finalized standing-recovery proof (`recoveryMeetsLowRomStyleFinalizeProof`) **plus** `standingRecoveryFinalize.finalizeSatisfied` **plus** `standingRecoveredAtMs - reversalAtMs >= minReversalToStandingMsForShallow` (caller-supplied minimum, no new constants in the helper).
- Keep `getGuardedTrajectoryReversalRescue` trigger conditions, `progressionReversalFrame`, `reversalConfirmedBy === 'trajectory'`, and the rest of completion machinery unchanged.

## Non-goals

- No changes to `squat-reversal-confirmation.ts` (ultra-shallow / shallow relax bands stay locked).
- No threshold constant edits, HMM assist, event promotion policy, owner / pass reason / confidence / latch / finalize policy, or trace/UI surfaces.

## Files changed

- `src/lib/camera/squat-completion-state.ts`
- `scripts/camera-pr-ascent-integrity-rescue-01-smoke.mjs` (new)
- `docs/pr/PR-CAM-ASCENT-INTEGRITY-RESCUE-01.md` (new)

## Acceptance

- `computeAscendConfirmed(rf) || true` **removed** (verified by search).
- Trajectory rescue **cannot** open ascent solely by being trajectory; ascent requires the helper’s rules.
- Deep `standard_cycle` and standing-only behavior preserved (smoke).
- Meaningful shallow synthetic path still completes (smoke).
- Fake-dip / weak-return synthetic path does not complete and hits a hard guard reason (smoke).

## Regression rerun (manual / CI)

- `npx tsx scripts/camera-pr-ascent-integrity-rescue-01-smoke.mjs`
- `npx tsx scripts/camera-cam31-squat-guarded-trajectory-reversal-smoke.mjs` (CAM-31 guarded trajectory rescue)

## Commit message (fixed)

`fix(camera): harden squat trajectory rescue ascent integrity without changing thresholds`
