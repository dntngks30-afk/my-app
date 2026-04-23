# PR-X Single Completion Authority Squat Implementation Note

## CURRENT_IMPLEMENTED

- Squat final pass now flows through `completion authority -> final pass surface`.
- `finalPassSource` is published as `completion`.
- `finalSuccessOwner` is emitted only as `completion_truth_standard`, `completion_truth_shallow`, or `null`.
- `completionBand` is emitted as `standard_or_deep`, `shallow`, `reject_ultra_low_static`, or `null`.
- `completionInvariantFailureReason` and `completionEpochId` are exposed for runtime/debug trace.

## Removed Final Authority

- pass-core remains diagnostic evidence only; `passCore.passDetected` and `passCore.passBlockedReason` no longer grant or veto final pass.
- `officialShallowPathClosed` remains shallow admission/bridge evidence only; `officialShallowOwnerFrozen` no longer opens final pass.
- event-cycle remains diagnostic/evidence only; it does not promote final pass.
- UI progression gate mirrors completion owner truth and does not re-judge final squat pass.
- success snapshot effective pass truth uses completion owner truth; pass-core is retained as raw diagnostic evidence.

## Acceptance Coverage

- `scripts/camera-pr-x-single-completion-authority-squat-smoke.mjs`
  - deep standard fixtures pass
  - shallow valid cycle passes with pass-core diagnostic blocker present
  - standing/static/no-descent/no-reversal/no-recovery/setup-blocked/cross-owner cases stay blocked
  - final pass source is completion
- Existing authority smokes updated to the PR-X owner contract:
  - `scripts/camera-pr-01-squat-completion-first-authority-freeze-smoke.mjs`
  - `scripts/camera-pr-cam-shallow-final-authority-repair-smoke.mjs`
  - `scripts/camera-pr-cam-squat-false-pass-guard-lock-02-smoke.mjs`
