# PR-SQUAT-V2-02B Runtime Owner Truth And Shallow Closure

## 1. Real-device failure summary

CURRENT_IMPLEMENTED:

PR5 made `SquatMotionEvidenceEngineV2` the intended squat runtime owner, but real-device dogfooding exposed that the owner truth was not visible or closed end-to-end in trace/runtime surfaces.

Observed real-device behavior:

- shallow squat attempts 1-3 did not progress
- deep squat attempt 4 progressed
- shallow attempts showed shallow motion evidence such as `relativeDepthPeak ~= 0.06`, `shallowCandidateObserved=true`, `attemptLikeMotionObserved=true`, and `motionDescendDetected=true`
- trace output did not clearly expose `v2RuntimeOwnerDecision` or `SquatMotionEvidenceEngineV2.usableMotionEvidence`

## 2. Shallow failure blockers observed

CURRENT_IMPLEMENTED:

The failing shallow traces were blocked or reported by legacy/final-gate style labels:

- `no_reversal`
- `no_return_to_start`
- `lower_body_motion_not_dominant`
- `not_armed`
- `setup_motion_blocked`

These labels are now retained only under legacy/compat/debug surfaces and cannot own squat progression.

## 3. Why PR5 smoke passed but real device failed

CURRENT_IMPLEMENTED:

The synthetic PR3/PR4 fixtures used explicit V2-style `lowerBodySignal` input, so V2 smoke and shadow compare correctly verified the motion-evidence contract.

The real-device evaluator path was different:

- production `PoseFeaturesFrame` input was passed into V2 without a runtime-specific V2 adapter
- shallow lower-body depth around `0.06` could be compared against upper-body/raw-point travel in a way that made `lower_body_motion_not_dominant` appear
- trace sinks copied selected legacy squat-cycle fields but omitted `v2RuntimeOwnerDecision`, `autoProgressionDecision`, and `legacyQualityOrCompat`
- attempt snapshot `progressionPassed` could still be reconstructed from generic gate fields instead of the explicit V2 owner decision

This PR fixes the runtime truth plumbing and trace surfacing. It does not add a shallow promotion path and does not tune thresholds to force a trace through.

## 4. Where V2 runtime owner decision is generated

CURRENT_IMPLEMENTED:

`src/lib/camera/evaluators/squat.ts` now adapts production `PoseFeaturesFrame` values into `SquatMotionEvidenceFrameV2` before calling:

```ts
evaluateSquatMotionEvidenceV2(toSquatMotionEvidenceV2Frames(validRaw))
```

The adapter exposes:

- `lowerBodySignal` from squat depth proxy
- `upperBodySignal` from normalized arm elevation / trunk lean
- body and lower-body visibility flags
- phase hint and source diagnostic fields

The evaluator exposes the decision at:

```ts
debug.squatMotionEvidenceV2
```

`src/lib/camera/auto-progression.ts` then emits:

```ts
squatCycleDebug.v2RuntimeOwnerDecision
```

## 5. Field consumed by auto-progression

CURRENT_IMPLEMENTED:

The squat auto-progression owner is:

```ts
owner: "squat_motion_evidence_v2"
consumedField: "usableMotionEvidence"
```

The exact runtime rule is:

```ts
v2RuntimeOwnerDecision.usableMotionEvidence === true  -> progression allowed
v2RuntimeOwnerDecision.usableMotionEvidence === false -> progression blocked
```

Trace field:

```ts
autoProgressionDecision: {
  owner: "squat_motion_evidence_v2",
  consumedField: "usableMotionEvidence",
  progressionAllowed,
  blockedReason,
}
```

## 6. Final blocker and legacy gates cannot block V2 pass

CURRENT_IMPLEMENTED:

For squat, `progressionPassed`, `completionSatisfied`, `finalPassEligible`, and `finalPassBlockedReason` are derived from V2 `usableMotionEvidence`.

Legacy/final-gate values are separated into:

```ts
legacyQualityOrCompat: {
  completionSatisfied,
  completionBlockedReason,
  passCoreBlockedReason,
  finalPassEligible,
  uiProgressionAllowedLegacy,
  officialShallowPathBlockedReason,
}
```

Therefore:

- `finalPassEligible` cannot flip V2 true to false
- `completionBlockedReason` cannot flip V2 true to false
- `squatUiGate` cannot flip V2 true to false
- pass-core / official shallow labels cannot flip V2 true to false
- legacy fallback cannot flip V2 false to true

## 7. Page latch does not recompute squat completion

CURRENT_IMPLEMENTED:

`isFinalPassLatched("squat", gate)` now consumes the already-computed owner trace first:

```ts
gate.squatCycleDebug.autoProgressionDecision.progressionAllowed
```

Trace field:

```ts
pageLatchDecision: {
  consumer: "isFinalPassLatched",
  sourceField: "gate.squatCycleDebug.autoProgressionDecision.progressionAllowed",
  recomputesSquatCompletion: false,
}
```

The page latch does not recalculate descent, reversal, return, legacy completion, or `finalPassEligible`.

## 8. Added real-device fixtures

CURRENT_IMPLEMENTED:

Added failure-class fixtures derived from the dogfooding logs. No uploaded raw real-device JSON trace was present in the workspace, so these fixtures encode the observed failure classes rather than an untouched device export.

- `valid_shallow_real_device_failed_01.json` -> expected pass, legacy blocker `no_reversal`
- `valid_shallow_real_device_failed_02.json` -> expected pass, legacy blocker `no_return_to_start`
- `valid_shallow_real_device_failed_03.json` -> expected pass, legacy blocker `setup_motion_blocked`
- `valid_deep_real_device_passed_01.json` -> expected pass

Existing standing/seated fail fixtures remain required in `manifest.json`.

## 9. Commands and results

CURRENT_IMPLEMENTED:

Passed:

```bash
npx tsx scripts/camera-squat-v2-00-golden-trace-harness.mjs --strict
# STRICT: all required contracts satisfied.

npx tsx scripts/camera-squat-v2-01b-shadow-compare.mjs --strict
# --strict: all V2 results match expected.

npx tsx scripts/camera-squat-v2-02b-runtime-owner-truth-smoke.mjs
# All PR5-FIX runtime owner truth checks passed.

npx tsx scripts/camera-squat-v2-01-motion-evidence-engine-smoke.mjs
# 120 passed, 0 failed
```

PR5-FIX runtime owner truth smoke results:

| fixture | expected | v2.usableMotionEvidence | auto owner | auto progression | status |
|---|---:|---:|---|---:|---|
| `valid_shallow_real_device_failed_01` | pass | true | `squat_motion_evidence_v2` | true | PASS |
| `valid_shallow_real_device_failed_02` | pass | true | `squat_motion_evidence_v2` | true | PASS |
| `valid_shallow_real_device_failed_03` | pass | true | `squat_motion_evidence_v2` | true | PASS |
| `valid_deep_real_device_passed_01` | pass | true | `squat_motion_evidence_v2` | true | PASS |
| `standing_must_fail_01` | fail | false | `squat_motion_evidence_v2` | false | PASS |
| `seated_must_fail_01` | fail | false | `squat_motion_evidence_v2` | false | PASS |

Additional checks:

```bash
npm run typecheck
# not available: Missing script "typecheck"

npm run lint
# current script invokes `next lint`; Next CLI reports invalid project directory `...\\lint`

npx tsc --noEmit --pretty false
# did not complete cleanly due existing repo-wide TypeScript errors outside this PR scope
```

## 10. Real-device verification result

NOT_YET_IMPLEMENTED:

This PR has not been re-dogfooded on the physical device inside this coding session. The next device run must verify:

- shallow squat passes naturally three times in a row
- deep squat still passes
- standing only fails
- seated/bottom hold fails
- incomplete return fails
- arm-only / upper-body-only fails
- exported trace includes `v2RuntimeOwnerDecision`, `autoProgressionDecision`, `legacyQualityOrCompat`, and `pageLatchDecision`

## 11. Conditions to move to PR6

LOCKED_DIRECTION:

Move to PR6 Legacy Quality Analyzer Demotion only after:

- PR5-FIX acceptance commands remain green
- physical device shallow closure is confirmed
- trace proves V2 owner truth is present in evaluator, auto-progression, attempt snapshot, and observation export
- legacy fields are confirmed as debug/compat only
