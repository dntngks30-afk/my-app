# PR-CAM-REVERSAL-SIGNAL-STABILIZATION-01 — Post-peak monotonic reversal assist for shallow/partial real-device squat attempts

## Problem

- Recent device JSON shows `attemptStarted`, `downwardCommitmentReached`, `descendConfirmed`, and `relativeDepthPeak` in the ~0.42–0.46 / `evidenceLabel: "standard"` range, yet completion stays on `completionBlockedReason: "no_reversal"`.
- Success only appears much later when motion is deeper (~0.78 relative peak), so the bottleneck is **reversal truth latency**, not admission depth.
- PR1–3 already addressed event owner, peak anchor, and rescue ascent integrity; those surfaces must **not** be changed here.

## Why this is not a threshold-widening PR

- No changes to event path, peak anchor, guarded trajectory rescue, owner, finalize, confidence, or latch policy.
- No edits to `squat-completion-state`, `squat-event-cycle`, `auto-progression`, `evaluators/squat`, or `pose-features`.
- Existing named thresholds (`ULTRA_SHALLOW_*`, `SHALLOW_*`, `WINDOW_RELAX_FACTOR`, `ASCENT_STREAK_*`, `HMM_BRIDGE_*`, strict hit rules) are **unchanged**.
- This PR only adds a **trajectory-based rule assist** inside `detectSquatReversalConfirmation`, ordered **after** `windowReversalRelax` and **before** `ascentStreakRelax`, returning `reversalSource: 'rule'` and note `post_peak_monotonic_reversal_assist`.

## Scope

- Add exported `postPeakMonotonicReversalAssist` (first 6 post-peak frames, `readSquatCompletionDepthForReversal`, ≥3 valid depths, ≥2 strict down steps of 0.002, cumulative drop ≥ `required * 0.88`, max partial ≥ `required * 0.72`).
- Wire success into `detectSquatReversalConfirmation` with `reversalIndex: peakValidIndex`, `reversalDepthDrop` / `reversalFrameCount` from the helper.

## Non-goals

- No completion-state / event-cycle / trace / auto-progression / evaluator / pose-features changes.
- No edits to existing reversal constants or relax factors.
- No HMM-as-owner promotion; HMM bridge remains after ascent streak as before.

## Acceptance

- Moderate-depth partial monotonic ascent can confirm reversal without strict 2-frame simultaneous hit.
- Standing noise, bottom stall, and single-spike post-peak patterns stay **false**.
- Deep standard path still confirms via existing strict/window rule chain.

## Smoke & regression

- `npx tsx scripts/camera-pr-reversal-signal-stabilization-01-smoke.mjs`
- Rerun: `camera-shallow-reversal-signal-01-smoke.mjs`, `camera-pr-04e2-squat-reversal-confirmation-stabilization-smoke.mjs`, and CAM-31 trajectory smoke as needed.

## Commit message (fixed)

`fix(camera): stabilize squat reversal signal for shallow partial ascent without changing thresholds`
