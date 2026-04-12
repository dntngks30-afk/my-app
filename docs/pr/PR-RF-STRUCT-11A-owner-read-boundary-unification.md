# PR-RF-STRUCT-11A — Squat Owner Read Boundary Unification

> This PR follows `docs/REFACTORING_SSOT_2026_04.md` and is limited to behavior-preserving extraction unless explicitly stated otherwise.

## Scope

- Consolidate the squat owner truth read boundary in `src/lib/camera/auto-progression.ts`.
- Make the main squat progression path and the `isFinalPassLatched(...)` fallback latch path read owner truth through the same adapter: `readSquatPassOwnerTruth(...)`.
- Preserve the current runtime owner priority: `squatPassCore.passDetected` is authoritative when `squatPassCore` is present.

## Non-goals

- No threshold changes.
- No pass/fail semantic changes.
- No blocked reason semantic changes.
- No shallow/standard meaning changes.
- No UI copy, route, navigation timing, setup/readiness, final blocker, quality, trace payload, or response schema changes.
- No pass-core or completion-state writer changes.

## Why behavior-preserving

- The main path previously built owner truth inline from `squatPassCore.passDetected`, `squatPassCore.passBlockedReason`, and completion-state pass/block reason fields.
- `readSquatPassOwnerTruth(...)` preserves that same mapping when `squatPassCore` is present.
- The no-`squatPassCore` boundary preserves the existing legacy completion-state fallback by delegating to `computeSquatCompletionOwnerTruth(...)`.
- UI progression gate ordering and final-pass blocker ordering are unchanged.
- Completion-state and pass-core semantics are untouched.

## Before/After owner truth read path

Before:

- Main squat path in `evaluateExerciseAutoProgress(...)` read owner truth inline from `squatPassCore`.
- Fallback latch path in `isFinalPassLatched(...)` read owner truth via `computeSquatCompletionOwnerTruth(...)`.
- The two paths could interpret the same runtime state through different read sources.

After:

- Main squat path calls `readSquatPassOwnerTruth(...)`.
- Fallback latch path calls `readSquatPassOwnerTruth(...)`.
- When `squatPassCore` exists, both paths interpret owner truth from the same pass-core authority.
- When `squatPassCore` is absent, both paths use the same explicit legacy completion-state fallback.

## Files changed

- `src/lib/camera/auto-progression.ts`
- `scripts/camera-rf-struct-11a-owner-read-boundary-smoke.mjs`
- `docs/pr/PR-RF-STRUCT-11A-owner-read-boundary-unification.md`

## Acceptance tests

- `npx tsx scripts/camera-rf-struct-11a-owner-read-boundary-smoke.mjs`
- Existing related squat/camera smoke pack:
  - `npx tsx scripts/camera-pr-pass-authority-reset-01-smoke.mjs`
  - `npx tsx scripts/camera-cam25-squat-easy-final-pass-smoke.mjs`
  - `npx tsx scripts/camera-cam29a-squat-no-mid-ascent-open-smoke.mjs`
  - `npx tsx scripts/camera-cam29a-squat-final-pass-timing-smoke.mjs`
  - `npx tsx scripts/camera-pr7-official-shallow-closer-integrity-smoke.mjs`
  - `npx tsx scripts/camera-pr8-official-shallow-timing-epoch-smoke.mjs`
  - `npx tsx scripts/camera-pr9-meaningful-shallow-default-pass-smoke.mjs`
  - `npx tsx scripts/camera-pr12-official-shallow-gold-path-convergence-smoke.mjs`
  - `npx tsx scripts/camera-pr13-shallow-current-rep-acquisition-stabilization-smoke.mjs`

## Residual risks

- This PR unifies only the owner-truth read boundary. UI gate/final-blocker chain cleanup remains a separate STRUCT-11B concern.
- Legacy no-`squatPassCore` callers still fall back to completion-state interpretation for compatibility; runtime evaluator output should include `squatPassCore`.
- Real-device dogfooding remains the primary validation for camera progression UX.
