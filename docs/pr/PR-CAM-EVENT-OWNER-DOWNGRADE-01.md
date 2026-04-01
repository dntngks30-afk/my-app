# PR-CAM-EVENT-OWNER-DOWNGRADE-01

Date: 2026-04-01  
Base: `main`

## Why event promotion was dangerous

Late `evaluateSquatCompletionState()` could **override** a non-closed rule-completion result and fabricate success (`completionSatisfied`, null `completionBlockedReason`, `*_cycle` pass reasons) when the shallow event-cycle gate matched. That split **success ownership** between rule completion and a parallel promotion path, making regressions and JSON diagnosis harder (“closed by rule vs closed by promotion”).

## What was removed

- The branch that returned a **promoted-success** object from `evaluateSquatCompletionState()` (no more `completionSatisfied: true`, `completionBlockedReason: null`, `low_rom_cycle` / `ultra_low_rom_cycle` from promotion, `cycleComplete: true`, `successPhaseAtOpen: 'standing_recovered'`, `completionFinalizeMode: 'event_promoted_finalized'`, or `eventCyclePromoted: true` from this path).

## What remains observable

- `detectSquatEventCycle(...)` unchanged — `squatEventCycle` still attached to state.
- The same boolean expression as before is still evaluated as `canEventPromote` (no threshold edits).
- New fields on `SquatCompletionState`:
  - `eventCyclePromotionCandidate` — true iff the former promotion gate would have passed.
  - `eventCyclePromotionBlockedReason` — first matching “why not” slug, or `event_promotion_owner_disabled` when candidate is true (promotion **disabled by product**, not a failure of detection).
- `eventCyclePromoted` is always stamped `false` at the end of `evaluateSquatCompletionState()` (legacy field retained for traces/tests).
- PR-0 `ownerTruthSource` will no longer become `'event_promotion'` from this pipeline for real completions; rule completion owns closure.

## Why thresholds were intentionally untouched

Promotion **eligibility** is preserved as a pure observability mirror so calibration and JSON diffs can compare “would have promoted” vs actual rule outcome without re-tuning HMM, depth floors, or finalize strings.

## Files changed

| File | Change |
|------|--------|
| `src/lib/camera/squat-completion-state.ts` | Remove success-closing promotion; add `deriveEventCyclePromotionObservability`; extend `SquatCompletionState` |
| `docs/pr/PR-CAM-EVENT-OWNER-DOWNGRADE-01.md` | This note |

## Verification

- Grep `evaluateSquatCompletionState` (tail): no `completionSatisfied: true` / `promotedPassReason` / `eventCyclePromoted: true` / `event_promoted_finalized` in the promotion branch (branch removed).
- Rule success still originates only from `evaluateSquatCompletionCore` / `resolveStandardDriftAfterShallowAdmission` as before.
