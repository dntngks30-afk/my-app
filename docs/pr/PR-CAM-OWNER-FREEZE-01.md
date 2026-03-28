# PR-CAM-OWNER-FREEZE-01 — Squat success owner observability lock

## Findings

- `passOwner`가 단일 문자열 `completion_truth`로만 노출되어, **standard_cycle** 성공과 **low/ultra_low event_cycle** 성공이 스냅샷·디버그에서 구분되지 않았다.
- `eventCyclePromoted` / `eventCycleDetected`는 이미 있으나, **최종 성공이 어떤 completion pass reason 밴드에서 열렸는지**와 한 줄로 대응되지 않아 실기기 JSON 해석 시 혼선이 생길 수 있다.

## Root cause

- 관측 계약이 PR-04D1 시점의 coarse `SquatPassOwner`에 고정되어 있었고, `completionPassReason` 분기(standard vs event)를 owner 문자열에 반영하지 않았다.

## Scope

- `resolveSquatPassOwner`의 **반환 문자열만** 세분화하고, `squatCycleDebug`·attempt `diagnosisSummary.squatCycle`에 동일 의미의 필드를 추가한다.
- **progressionPassed / isFinalPassLatched / completionSatisfied** 조합식은 변경하지 않는다.

## Non-goals

- 스쿼트 completion truth·arming·event-cycle·pose-features 로직 변경.
- 임계값·패스 조건·카메라 UX·라우트·실행 코어 변경.

## Files changed

- `src/lib/camera/squat/squat-progression-contract.ts`
- `src/lib/camera/auto-progression.ts`
- `src/lib/camera/camera-trace.ts`
- `scripts/camera-cam-owner-freeze-01-smoke.mjs`
- `docs/pr/PR-CAM-OWNER-FREEZE-01.md`

## Acceptance tests

- `npx tsx scripts/camera-cam-owner-freeze-01-smoke.mjs` 통과(리졸버·게이트·`buildAttemptSnapshot` squatCycle 필드).
- `completionPassReason === 'standard_cycle'` → `finalSuccessOwner === 'completion_truth_standard'`, `standardOwnerEligible === true`.
- Event cycle pass reason → `finalSuccessOwner === 'completion_truth_event'`, `shadowEventOwnerEligible === true`.
- Resolver: invalid / severeInvalid → `blocked_by_invalid_capture`.
- 깊은 표준 픽스처에서 `isFinalPassLatched('squat', gate)` 여전히 true (산식 회귀 없음).

## Rollback

- 단일 커밋 revert 시 `SquatPassOwner`·디버그 필드가 이전 값으로 복귀한다. 스냅샷 소비자가 새 필드에 의존하기 시작했다면 소비 측 optional 처리 유지.

## 왜 안전한가

- gate 판정에 쓰이는 **숫자 임계·분기**는 건드리지 않고, `evaluateExerciseAutoProgress`가 이미 계산한 `completionSatisfied`·`completionPassReason`·`decoupleEligible`·guardrail을 **읽어 문자열과 불리언만 추가**한다.
- `camera-trace`는 기존 `squatCycle` 블록에 필드를 **추가**할 뿐, 스냅샷 구조의 필수 계약을 깨지 않는다.
