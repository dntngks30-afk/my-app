# PR-CAM-ARMING-BASELINE-HANDOFF-01 — Seed completion baseline from validated arming standing window

## Problem

- Device JSON shows `baselineStandingDepth` can sit around **0.23** while `rawDepthPeak` is **0.32–0.43**, suppressing `relativeDepthPeak` (~0.09–0.20) and blocking completion despite real attempt signals.
- The same session later shows `baselineStandingDepth` **0.04** and `relativeDepthPeak` **0.46** when standing is interpreted correctly.
- The evaluator already arms using a **validated standing window**, but `evaluateSquatCompletionState` recomputed baseline from the **first `BASELINE_WINDOW` frames of the completion slice**—which may already be partially descended—causing a **baseline handoff mismatch**.

## Why this is not a reversal-threshold / event / anchor PR

- No changes to `squat-reversal-confirmation.ts`, event-cycle, peak anchor truth, trajectory rescue, owner, finalize, confidence, or latch policy.
- No threshold constant edits; only **where baseline truth is sourced** (arming handoff vs slice-front fallback).

## Scope

- **`CompletionArmingState`**: store `armingBaselineStandingDepthPrimary` / `armingBaselineStandingDepthBlended` from the same standing window used for arming (peak-anchored, 10-frame, and 4-frame fallback paths).
- **`readSquatArmingDepthPrimaryOnly`**: exported; primary-only read for standing primary min (blended path unchanged for stability checks).
- **Evaluator**: pass `seedBaselineStandingDepth*` into `evaluateSquatCompletionState`; expose `armingBaselineStandingDepth*`, `completionBaselineSeeded` in `highlightedMetrics`.
- **Completion-state**: prefer seeds for `baselinePrimary` / `baselineBlended` (blended defaults to primary when blended seed absent); use same seeds for **depth freeze** frozen baseline when present; `baselineSeeded === true` when primary seed is finite.

## Non-goals

- No pass widening, event reopening, anchor or rescue edits, pose-feature changes, or completion rule logic beyond baseline sourcing.

## Regression safety (PR1–3)

- Does not alter event promotion gates, commitment-safe peak anchor, or trajectory-rescue ascent integrity; those paths consume the same completion state outputs with a **more stable** baseline input.

## Acceptance

- Shallow / moderate attempts: `relativeDepthPeak` no longer systematically collapses when the slice starts after standing but slice-front depth is already elevated—**if** arming provides seeds (armed paths).
- Deep `standard_cycle` and standing-noise negatives preserved (smoke).

## Smoke & regression

- `npx tsx scripts/camera-pr-arming-baseline-handoff-01-smoke.mjs`
- Rerun: `camera-peak-anchor-integrity-01-smoke.mjs`, `camera-pr-04e2-squat-reversal-confirmation-stabilization-smoke.mjs`, CAM-31 smoke as needed.

## Commit message (fixed)

`fix(camera): seed squat completion baseline from arming standing window without changing thresholds`
