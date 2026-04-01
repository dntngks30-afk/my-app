# PR-CAM-OWNER-TRACE-LOCK-00

Goal: add owner-trace observability only for squat pass truth without changing thresholds or gate logic.

Files:
- src/lib/camera/evaluators/squat.ts
- src/lib/camera/auto-progression.ts
- src/lib/camera/squat-completion-state.ts
- src/lib/camera/squat/squat-progression-contract.ts

Add three debug fields:
- ownerTruthSource
- ownerTruthStage
- ownerTruthBlockedBy

Derive from existing completion-state only:
- ownerTruthSource = event_promotion if eventCyclePromoted, else rule_completion if completionSatisfied, else none
- ownerTruthStage = closed if completionSatisfied, else admission if attemptStarted is not true, else reversal if reversalConfirmedAfterDescend is not true, else recovery if recoveryConfirmedAfterReversal is not true, else blocked
- ownerTruthBlockedBy = null if completionSatisfied else completionBlockedReason or owner_not_closed

Hard rules:
- no threshold changes
- no pass logic changes
- no event-promotion logic changes
- no owner truth changes
- no UI latch changes

Acceptance:
- behavior unchanged
- new fields visible in squat debug output
