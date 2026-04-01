# PR-CAM-AUTHORITATIVE-REVERSAL-SPLIT-02

Date: 2026-04-01  
Base: `main`

## Problem (real-device JSON)

Shallow halted attempts could show `trajectoryReversalRescueApplied=true` and `reversalEvidenceProvenance="trajectory_anchor_rescue"` while completion still had `completionBlockedReason="no_reversal"` and `reversalConfirmedAfterDescend=false`. Deep success already closed via strict `reversalConfirmedBy="rule"`. The fix is **truth-layer separation**, not threshold tuning.

## Authoritative reversal (owner-safe)

Only these count for **`ownerAuthoritativeReversalSatisfied`**:

- Strict `detectSquatReversalConfirmation` → `revConf.reversalConfirmed`
- HMM reversal assist when part of the authoritative assist chain → `hmmReversalAssistDecision.assistApplied`
- Official shallow completion stream bridge → `officialShallowStreamBridgeApplied`

## Provenance-only reversal evidence

These populate **`provenanceReversalEvidencePresent`** only (never authoritative by themselves):

- `trajectoryRescue.trajectoryReversalConfirmedBy === 'trajectory'` (same signal as `trajectoryReversalRescueApplied`)
- `tailBackfill.backfillApplied` (`reversalTailBackfillApplied`)
- `ultraShallowMeaningfulDownUpRescueApplied`

Legacy fields (`reversalConfirmedAfterDescend`, `reversalConfirmedBy`, `reversalEvidenceProvenance`, etc.) are **unchanged** for backward compatibility; new fields make the split explicit for PR-3 owner tightening.

## Authoritative recovery (observability)

**`ownerAuthoritativeRecoverySatisfied`** = authoritative reversal **and** `standingRecoveredAtMs != null` **and** `standingRecoveryFinalize.finalizeSatisfied` (final finalize state after existing guards). Distinct from timeline-only “recovery looks true.”

## What was not changed

- Numeric thresholds, event-cycle, reversal detector constants, UI latch, `computeSquatCompletionOwnerTruth`, `computeSquatUiProgressionLatchGate`
- Event promotion downgrade (prior PR) unchanged

## Files

| File | Role |
|------|------|
| `src/lib/camera/squat-completion-state.ts` | Tighten `ownerAuthoritativeReversalSatisfied`; add `provenanceReversalEvidencePresent`, `ownerAuthoritativeRecoverySatisfied`; stamp + attach pass-through |
| `src/lib/camera/auto-progression.ts` | `SquatCycleDebug` pass-through |
| `src/lib/camera/squat/squat-reversal-confirmation.ts` | Comment clarity only |

## PR-3

Final pass ownership can consume `ownerAuthoritativeReversalSatisfied` / `ownerAuthoritativeRecoverySatisfied` vs `provenanceReversalEvidencePresent` without re-deriving from mixed signals.
