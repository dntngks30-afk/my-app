# PR-CAM-REVERSAL-TAIL-BACKFILL-01 — Backfill squat reversal truth from guarded standing-tail evidence without changing thresholds

## Problem

- Latest JSON shows many armed attempts remain stuck at `no_reversal`.
- Those same attempts later show recovery-tail evidence (`recovery_hold_too_short`) before eventual success.
- This means tail recovery is sometimes visible before explicit reversal latches.
- The bottleneck is reversal latch latency, not admission depth.

## Why this is not a reversal-threshold PR

- No reversal detector thresholds changed.
- No event-cycle changes.
- No peak anchor changes.
- No finalize policy changes.
- No owner/confidence changes.
- Only completion-state late backfill of the reversal anchor is added.

## Scope

- Add guarded standing-tail reversal backfill (`getGuardedStandingTailReversalBackfill`).
- Apply only when explicit reversal is still missing and trajectory rescue did not already set a progression reversal frame.
- Reuse `trajectoryRescueMeetsAscentIntegrity` for ascent truth after tail backfill (no `|| true` bypass).
- Expose `reversalTailBackfillApplied` on `SquatCompletionState`.
- Map tail backfill to `reversalConfirmedBy: 'trajectory'` when rule/HMM did not already own reversal (same as trajectory rescue semantics).

## Non-goals

- No success widening.
- No event path reopening.
- No raw detector metric fabrication (`reversalDepthDrop` / `reversalFrameCount` stay rule/HMM-sourced).
- No rescue policy rewrite.

## Acceptance

- `no_reversal`-only attempts can move to a more accurate later blocked reason when tail evidence is already present (drop, recovery continuity, standing timing).
- Seated hold / fake dip / standing noise remain blocked by existing guards.
- Explicit rule/HMM reversal path unchanged when it already fires.
- Ascent integrity still required for progression ascend truth after tail backfill.
- Success is not opened for free.

## Regression smokes (rerun manually)

- `npx tsx scripts/camera-pr-ascent-integrity-rescue-01-smoke.mjs`
- `npx tsx scripts/camera-cam31-squat-guarded-trajectory-reversal-smoke.mjs`
- `npx tsx scripts/camera-peak-anchor-integrity-01-smoke.mjs`

## Commit message

`fix(camera): backfill squat reversal truth from standing-tail evidence without changing thresholds`
