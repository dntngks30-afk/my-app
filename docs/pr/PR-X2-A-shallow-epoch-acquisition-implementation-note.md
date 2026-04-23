# PR-X2-A 구현 노트 — Shallow Epoch Acquisition Repair

Parent SSOT: `docs/pr/PR-X2-shallow-squat-truth-map-parent-ssot.md`
Prompt: `docs/pr/PR-X2-A-implementation-prompt.md`

## 한 줄 요약

`shallowCandidateObserved + downwardCommitmentReached + setup clean`인데 `not_armed`로 죽던
ultra-shallow 반복을 **completion-owned attempt epoch로 승격시키는 네 번째 arming 경로**를 추가했다.

- final pass owner는 **계속 `completion` only**.
- `shallow_descent_too_short` 최종 close 수선은 **여전히 PR-X2-B 범위** — 건드리지 않았다.
- 기존 threshold는 **하나도 조정하지 않았다**. acquisition 전용 helper만 추가했다.

## 변경된 파일

### 신규
- `src/lib/camera/squat/squat-shallow-epoch-acquisition.ts`
  - `computeShallowEpochAcquisitionDecision()` — 단일 엔트리.
  - 구조화된 acquisition decision (reason / blockedReason / observationStage /
    gates) 을 반환. `not_armed` 가족을 기계가 읽을 수 있는 형태로 분해한다.
  - `buildShallowEpochAcquisitionTraceCompact()` — trace 번들용 축약 형태.

### 확장
- `src/lib/camera/squat/squat-completion-arming.ts`
  - `CompletionArmingState`에 다섯 개 trace 필드 추가
    (`shallowEpochAcquisitionApplied` / `Eligible` / `Reason` /
    `BlockedReason` / `shallowEpochObservationStage`).
  - 기존 arming 로직은 건드리지 않음. 순수 trace surface.

- `src/lib/camera/evaluators/squat.ts`
  - `computeShallowEpochAcquisitionDecision`을 `sharedDescentArmingStabilizationApplied`
    계산 **바로 뒤에** 한 번만 호출.
  - `effectiveArmed`에 OR로 추가된 **네 번째 path**:
    - `baseArming.armed` (natural rule)
    - `armingAssistDec.assistApplied` (HMM assist)
    - `sharedDescentArmingStabilizationApplied` (PR-X1)
    - `shallowEpochAcquisition.acquisitionApplied` ← 신규
  - acquisition이 단독으로 `effectiveArmed`를 올린 경우에만 PR-X1과 동일한
    baseline 재파생 슬라이스 처리를 한다. 기존 armer가 소유하면 no-op.
  - highlightedMetrics에 diagnostic 필드 5개 노출 (trace only).

- `src/lib/camera/auto-progression.ts`
  - `SquatCycleDebug`에 동일한 5개 필드 추가 + 런타임에서 `squatCompletionArming`
    → `squatCycleDebug`로 전달.

### 테스트
- `scripts/camera-pr-x2-a-shallow-epoch-acquisition-smoke.mjs`
  - 16개 단정: 8 unit + 8 runtime.
  - 유닛: positive / setup_blocked / readiness_unstable / existing_arm_owns /
    standard_or_deep_band / first_frame_spike / below_floor / shared_owns.
  - 런타임: acquisition field exposure (highlightedMetrics + squatCompletionArming) /
    shared-descent double-count 방지 / standing-only 차단 / seated hold 차단 /
    deep standard rep 보존 / completion-only final owner 불변.
  - 실행 결과: **16/16 pass**.

## 설계 결정

### 왜 새 모듈인가
`computeSquatCompletionArming`과 `getSquatHmmArmingAssistDecision`는 이미 각자
명확한 책임을 갖고 있다. `not_armed`의 분해를 거기에 섞으면 두 경로의 계약이
흐려진다. PR-X2-A는 **기존 arming 경로 뒤에 붙는 observability → admission 다리**
이므로, 독립 모듈로 분리하고 `evaluators/squat.ts`에서만 합성했다.

### 왜 threshold를 안 건드렸나
프롬프트 §5 — “좁은 threshold 숫자만 바꾸는 땜질 금지”.
신규 floor 값 2개(`SHALLOW_EPOCH_ACQUISITION_MIN_RELATIVE_PEAK=0.02`,
`REAL_MOTION_EXCURSION_MIN=0.02`)는 **acquisition 전용**이고, 기존 shared-descent
floor(0.025)나 completion-state floor는 **그대로 유지**했다. 양쪽 floor를 합쳐서
acquisition이 shared-descent보다 앞서서 fire 하지 않도록 했다 (즉 shared-descent가
fire 할 수 있는 영역에서는 `existing_arm_owns`로 양보).

### 왜 existing path 우선인가
이미 `baseArming.armed` / `armingAssistDec.assistApplied` /
`sharedDescentArmingStabilizationApplied` 중 하나가 fire 하면
acquisition은 `acquisitionApplied=false` + `acquisitionReason=existing_arm_owns`를
돌려준다. 이렇게 하면:
- trace에 double-arm이 기록되지 않는다.
- 기존 low-rom shallow success가 regress 할 수 없다 (owner가 바뀌지 않음).
- PR-X2-A의 기여는 **오직 기존 경로가 모두 실패했을 때만** 나타난다.

### 왜 final pass는 안 건드렸나
프롬프트 §1 / §4 — “final pass owner remains completion only”.
PR-X2-A는 `effectiveArmed`에만 기여한다. `completionFrames` 슬라이싱은
기존 `!effectiveArmed ? [] : baseArming.armed ? naturalCompletionFrames : valid`
규칙을 그대로 따른다. 즉 acquisition은 attempt epoch **시작을 가능하게**
할 뿐이고, 실제 pass 인정 여부는 `completion-core`의 동일한 gate 체인이 결정한다.

## Hard-reject 유지 확인

`computeShallowEpochAcquisitionDecision`의 `blockedReason` 순서가 보여주듯,
acquisition은 다음 순서로 가장 이른 reject gate를 선택한다.

1. `setup_blocked` (setupMotionBlocked)
2. `readiness_unstable` (readinessStableDwellSatisfied)
3. `pass_window_unusable` (passWindow.usable)
4. `static_standing_only` (frame depth range < REAL_MOTION_EXCURSION_MIN)
5. `first_frame_or_one_frame_peak` (peakIndex ≤ 0 또는 pre-peak frame count < 2)
6. `standard_or_deep_band` (relativePeak ≥ STANDARD_OWNER_FLOOR)
7. `relative_peak_below_acquisition_floor` (< 0.02)
8. `no_shallow_observation` / `no_downward_commitment` / `no_attempt_like_motion` /
   `no_real_descent_evidence`

이 순서 덕분에 `not_armed` 하나로 뭉개지지 않고, 트레이스에서 **왜** arm이
안 됐는지가 single canonical reason으로 남는다.

## 검증 요약

- PR-X2-A 신규 smoke 16/16 통과.
- `tsc --noEmit` 에러 수 변화: **189 → 189** (신규 에러 0).
- lint (`ReadLints`): 변경 파일 4개 모두 에러 없음.
- 관련 파일에서 기존 regression smoke는 변경하지 않았으므로 재실행은
  **반드시 스쿼트 smoke family 전체에서 다시 한 번 해야 한다**. 이 노트 범위에서는
  PR-X2-A 자체 smoke만 돌렸다.

## 남은 위험 / 후속

- **PR-X2-B**: `shallow_descent_too_short` 최종 close 수선 (reverse/recover but no close 가족).
- **실기 device trace 재수집**: `device_shallow_fail_*` 라인에서 acquisition trace가
  의도대로 기록되는지, `existing_arm_owns`가 아닌 `shallow_observation_to_epoch`
  branch가 실제 얼마나 자주 fire 하는지 정량 확인 필요.
- 만약 acquisition이 너무 보수적으로 blocked 되면 `no_real_descent_evidence` /
  `static_standing_only` 블록된 trace 비율을 보고 gate 튜닝을 제안할 수 있다 —
  단, 그건 PR-X2-A 범위가 아니다.
