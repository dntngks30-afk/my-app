# PR-V2-INPUT Real-Device Acceptance — 2026-04-27

## Status

**Accepted.**

This document records the final real-device acceptance result for the Squat V2 input ownership, safety guard, recovery, and observability series.

**증거 범위:** 아래 「Final passing trace summary」의 압축 필드는 첨부 실기기 JSON 두 건 각각의 **스쿼트 통과 시도 1건**에서만 추출하였다. 체크리스트 3~6행(must-fail 패턴)은 동일 실기기 캠페인에서 운영자가 확인한 **제품 수준 잠금**이며, 해당 항목 전용 스쿼트 trace 원시본은 본 저장소에 커밋하지 않는다(대용량·스냅샷 가능성).

---

## Scope

Covered PR series:

- PR-V2-INPUT-01 — Squat V2 Raw Landmark Depth Owner
- PR-V2-INPUT-02 — Lower Body Dominance Lock
- PR-V2-INPUT-03 — V2 Attempt State Machine
- PR-V2-INPUT-04 — Minimal Observability Surface
- PR-V2-INPUT-04B — V2 Runtime Owner Safety Guard
- PR-V2-INPUT-05 — Shallow Active Epoch Recovery
- PR-V2-INPUT-05B — Shallow Recovery Safety Lock
- PR-V2-INPUT-05C — Valid Motion Recovery Trigger Expansion
- PR-V2-INPUT-06 — Deep Squat Input Acquisition Audit

---

## Real-device acceptance checklist

| Case | Expected | Observed | Result |
|------|:--------:|:--------:|:------:|
| Shallow squat | pass | pass | ✅ |
| Deep squat | pass | pass | ✅ |
| Standing still 10s | fail | fail | ✅ |
| Standing + small arm/limb movement 10s | fail | fail | ✅ |
| Step-in / camera-close / whole-body translation | fail | fail | ✅ |
| Descent-start-only hold 5s+ | fail | fail | ✅ |
| Descent-start-only → stand up | pass after full cycle | pass | ✅ |

---

## Final passing trace summary

### A. Shallow pass (source: `shallow pass truth.json`, attempt `trace-1777230316197-5uzhnn2`, `ts` 2026-04-26T19:05:16.197Z)

| Field | Value |
|--------|--------|
| `movementType` | `squat` |
| `outcome` | `ok` |
| `progressionPassed` | `true` |
| `finalPassLatched` | `true` |
| `autoProgressionDecision.owner` | `squat_motion_evidence_v2` |
| `autoProgressionDecision.consumedField` | `usableMotionEvidence` |
| `autoProgressionDecision.progressionAllowed` | `true` |
| `v2RuntimeOwnerDecision.usableMotionEvidence` | `true` |
| `v2RuntimeOwnerDecision.motionPattern` | `down_up_return` |
| `v2RuntimeOwnerDecision.romBand` | `deep` |
| `v2RuntimeOwnerDecision.blockReason` | `null` |
| `v2InputSelectedDepthSource` | `hip_center_baseline` |
| `v2InputDepthCurveUsable` | `true` |
| `v2InputFiniteButUselessDepthRejected` | `false` |
| `usedRollingFallback` | `false` |
| `v2EpochSource` | `active_attempt_epoch_without_baseline` |
| `v2LowerUpperMotionRatio` | `14.574938834066334` |
| `v2TranslationDominant` | `false` |
| `v2OperatorSummary` | `V2 input: hip_center_baseline \| curve usable \| pass \| lower_ratio=14.57 \| translation=no \| peak_tail=10f \| closure_fresh=yes \| epoch=active_attempt_epoch_without_baseline \| fallback=no` |
| `v2DeepInputAudit.validRawFrameCount` | `95` |
| `v2DeepInputAudit.v2InputFrameCount` | `95` |
| `v2DeepInputAudit.validRawKneeAngleRangeDeg` | `8.459221733505387` |
| `v2DeepInputAudit.v2InputKneeAngleRangeDeg` | `8.459221733505387` |
| `v2DeepInputAudit.validRawMaxRuntimeDepthCandidate` | `0.058640039933477245` |
| `v2DeepInputAudit.v2InputMaxRuntimeDepthCandidate` | `0.058640039933477245` |

**참고(맥락만):** 동일 trace에서 `diagnosisSummary.squatCycle.depthBand`는 `shallow`로 남아 있으나, V2 소유자 판정은 위와 같이 완주·`usableMotionEvidence=true`이다. `v2DeepInputAudit.likelyRootCause`는 `tail_spike_only`(관측용)로 찍혀 있으며 pass 판정과 별계이다.

---

### B. Deep / bottleneck passage (source: `success in blocking bottleneck passage.json`, attempt `trace-1777230362050-tpm1p3v`, `ts` 2026-04-26T19:06:02.050Z)

| Field | Value |
|--------|--------|
| `movementType` | `squat` |
| `outcome` | `ok` |
| `progressionPassed` | `true` |
| `finalPassLatched` | `true` |
| `autoProgressionDecision.owner` | `squat_motion_evidence_v2` |
| `autoProgressionDecision.consumedField` | `usableMotionEvidence` |
| `autoProgressionDecision.progressionAllowed` | `true` |
| `v2RuntimeOwnerDecision.usableMotionEvidence` | `true` |
| `v2RuntimeOwnerDecision.motionPattern` | `down_up_return` |
| `v2RuntimeOwnerDecision.romBand` | `deep` |
| `v2RuntimeOwnerDecision.blockReason` | `null` |
| `v2InputSelectedDepthSource` | `hip_center_baseline` |
| `v2InputDepthCurveUsable` | `true` |
| `v2InputFiniteButUselessDepthRejected` | `false` |
| `usedRollingFallback` | `false` |
| `v2EpochSource` | `active_attempt_epoch_without_baseline` |
| `v2LowerUpperMotionRatio` | `16.873468772827184` |
| `v2TranslationDominant` | `false` |
| `v2OperatorSummary` | `V2 input: hip_center_baseline \| curve usable \| pass \| lower_ratio=16.87 \| translation=suspected \| peak_tail=14f \| closure_fresh=yes \| epoch=active_attempt_epoch_without_baseline \| fallback=no` |
| `v2DeepInputAudit.validRawFrameCount` | `104` |
| `v2DeepInputAudit.v2InputFrameCount` | `50` |
| `v2DeepInputAudit.validRawKneeAngleRangeDeg` | `130.25502771868418` |
| `v2DeepInputAudit.v2InputKneeAngleRangeDeg` | `130.25502771868418` |
| `v2DeepInputAudit.validRawMaxRuntimeDepthCandidate` | `0.975542669039402` |
| `v2DeepInputAudit.v2InputMaxRuntimeDepthCandidate` | `0.975542669039402` |

**Known caveat (동일 trace):** `legacyQualityOrCompat.passCoreBlockedReason`에 `setup_motion_blocked:large_framing_translation`가 남아 있을 수 있다. 본 수락에서는 **V2 + auto-progression**이 최종 진행을 소유하며, 실기기 must-fail(서 있기·팔만·이동·하강만 장시간 등)이 열리지 않았음을 전제로 **릴리스 블로커로 보지 않는다.** 향후 **setup/프레이밍만**으로 제품 진행이 열리는 trace가 나오면, V2·복구 규칙을 약화하기보다 **별도의 좁은 가드**를 추가한다.

---

## Important interpretation

The final acceptance behavior is:

- no pass while standing still
- no pass from limb-only movement
- no pass from setup/whole-body translation
- no pass from descent-start-only hold
- pass only after a complete down → up → return cycle is observed by V2

Record that the final successful pass is owned by:

```txt
owner = squat_motion_evidence_v2
consumedField = usableMotionEvidence
```

---

## Regression lock

Before future camera squat changes are accepted, manually re-run:

- shallow squat pass
- deep squat pass
- standing still fail
- limb-only fail
- step-in / camera-close / whole-body translation fail
- descent-start-only hold fail
- descent-start-only → stand-up pass

**Do not** mark a future PR accepted if any must-fail case passes.

---

## Raw evidence policy

The raw full JSON was used as review evidence but **intentionally not committed** because it contains large nested trace data and possible image/base64 snapshot payloads.

If fixture locking is needed later, create a **sanitized minimal fixture** with only the relevant fields.
