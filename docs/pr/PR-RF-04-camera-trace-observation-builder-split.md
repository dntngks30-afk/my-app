This PR follows `docs/REFACTORING_SSOT_2026_04.md` and is limited to behavior-preserving extraction unless explicitly stated otherwise.

# PR-RF-04 — `camera-trace.ts` observation builder split

## 1. Scope

부모 SSOT에서 잠긴 `B2. Observation builders split` 단계에 해당한다. 즉, `src/lib/camera/camera-trace.ts` 안에 남아 있는 observation record builder cluster를 별도 파일로 분리하는 PR이다. 부모 문서는 `camera-trace.ts`를 trace types/schemas, builders, localStorage persistence, diagnosis summary builders, observation event builders, quick stats/export helpers로 나누는 장기 방향을 잠갔고, 그중 RF-04는 storage split 다음 단계인 observation builders split만 다루도록 고정한다. fileciteturn0file1L175-L205

업로드된 RF-04 메모 기준으로 이번 PR의 실제 대상은 아래 관측 레코드 생성 책임이다. squat/overhead observation event type과 payload type, squat/overhead observation shaping helper, observation dedup helper, 그리고 observation builder에 직접 종속된 read helper/compact derivation helper를 `camera-trace.ts`에서 분리한다. 또한 storage split은 이미 main에 반영된 상태이므로, RF-04는 storage가 아니라 observation layer만 건드리는 PR로 잠가야 한다. fileciteturn0file0L1-L9 fileciteturn0file0L11-L23

### Included in scope

- `SquatCameraObservabilityExport`
- `buildSquatCameraObservabilityExport`
- `SquatObservationEventType`
- `ObservationTruthStage`
- `SquatAttemptObservation`
- `computeObservationTruthFields`
- `relativeDepthPeakBucket`
- `readHighlighted`
- `deriveSquatObservabilitySignals`
- `squatDownwardCommitmentReachedObservable`
- `buildSquatAttemptObservation`
- `observationDedupSkip`
- `OverheadObservationEventType`
- `OverheadAttemptObservation`
- `buildOverheadAttemptObservation`
- `overheadObservationDedupSkip`
- observation builder가 직접 쓰는 최소 shared read helper (`buildTopReasons` 포함)

### Out of scope

- storage split
- diagnosis summary split
- attempt snapshot split
- quick stats / export split
- trace schema redesign
- runtime 판정 로직 변경

이는 RF-04 메모의 범위 잠금과 동일하다. fileciteturn0file0L25-L42

---

## 2. Problem statement

현재 `camera-trace.ts`는 observation builder cluster, attempt snapshot builder, diagnosis summary, storage, quick stats, export surface가 한 파일에 함께 섞여 있다. 부모 SSOT는 이미 이 상태를 `P1` 핵심 리팩토링 대상으로 잠갔고, trace가 운영 로직과 너무 가까워질 위험, localStorage/export concern이 domain builder와 섞이는 위험, 훗날 trace가 runtime truth처럼 오해될 위험을 명시했다. fileciteturn0file1L27-L33 fileciteturn0file1L176-L193

RF-03에서 storage split이 끝났다면, 다음 가장 안전한 단계는 observation record를 만드는 builder cluster만 떼어내는 것이다. 이 단계는 구조적으로는 의미가 크지만, 제품/판정 관점에서는 sink-only observability layer의 코드 위치만 정리하는 단계여야 한다. 즉 trace는 여전히 판정을 바꾸는 레이어가 아니고, observation JSON은 여전히 읽기용 진단 surface여야 한다. fileciteturn0file1L87-L90 fileciteturn0file0L108-L112

---

## 3. Refactoring goal

이번 PR의 목표는 단 하나다.

> `camera-trace.ts`에서 observation record를 만드는 builder cluster만 별도 파일로 이동하고, 외부 surface와 출력 의미는 그대로 유지한다.

즉 바뀌는 것은 아래뿐이다.

- 코드 위치
- import 구조
- 내부 delegate 경계

바뀌면 안 되는 것은 아래다.

- observation payload 의미
- dedup 방식
- event edge semantics
- `prior` / `priorReason` 해석
- `buildTopReasons` 결과
- squat / overhead builder가 읽는 truth source 우선순위

이는 업로드된 RF-04 메모의 핵심 잠금과 동일하다. fileciteturn0file0L102-L113

---

## 4. Recommended physical boundary

가장 안전한 1차 경계는 신규 파일 1개다.

### Keep
- `src/lib/camera/camera-trace.ts`

### Add
- `src/lib/camera/trace/camera-trace-observation-builders.ts`

이 경계는 RF-04 메모의 권장안과 동일하다. 이유는 세 가지다. 첫째, RF-04는 아직 trace 구조 정리의 2단계이므로 squash/overhead를 별도 2파일로 다시 쪼개면 import churn이 커진다. 둘째, squat/overhead가 일부 helper를 공유하기 때문에 지금 더 잘게 쪼개면 shared helper의 ownership이 오히려 애매해진다. 셋째, 이번 단계는 “builder 덩어리 분리”까지만 하고 diagnosis/export/quick-stats 분리는 다음 PR로 넘겨야 회귀 리스크가 낮다. fileciteturn0file0L43-L59

### Boundary rule

- `camera-trace.ts`는 public surface와 상위 orchestration을 유지한다.
- 새 파일은 observation payload types + builder helpers + dedup helpers를 소유한다.
- cycle이 생기면 `camera-trace.ts`를 다시 import하지 말고, observation builder가 직접 의존하는 shared read helper를 새 파일로 같이 이동한다.

특히 `buildTopReasons`는 `buildSquatAttemptObservation`이 직접 의존하는 최소 shared helper이므로, RF-04에서는 duplication이나 reverse import를 피하기 위해 새 builder 파일로 같이 옮기는 것이 권장된다. fileciteturn0file0L76-L87

---

## 5. Files changed

### Primary target
- `src/lib/camera/camera-trace.ts`

### New file
- `src/lib/camera/trace/camera-trace-observation-builders.ts`

### Optional supporting change
아래는 허용되지만, observation builder split에 직접 필요한 최소 수준만 허용한다.

- `src/lib/camera/trace/*` 내부 import 정리
- 타입/헬퍼 re-export 정리

### Must remain untouched in meaning
RF-04 이후에도 아래는 `camera-trace.ts`에 남아 public surface 역할을 유지해야 한다. 업로드 메모는 이 얇은 delegate 유지가 더 안전하다고 잠가 두었다. fileciteturn0file0L34-L41

- `pushSquatObservation`
- `getRecentSquatObservations`
- `getRecentSquatObservationsSnapshot`
- `clearSquatObservations`
- `recordSquatObservationEvent`
- `pushOverheadObservation`
- `getRecentOverheadObservations`
- `clearOverheadObservations`
- `recordOverheadObservationEvent`

그리고 아래 상위 surface도 그대로 `camera-trace.ts`에 남겨야 한다. fileciteturn0file0L88-L96

- `AttemptSnapshot` type
- `TraceMovementType`
- `TraceOutcome`
- `stepIdToMovementType`
- `gateToOutcome`
- `extractStabilitySummary`
- `extractPerStepSummary`
- `RecordAttemptOptions`
- `buildDiagnosisSummary`
- `buildAttemptSnapshot`
- `pushAttemptSnapshot`
- `getRecentAttempts`
- `clearAttempts`
- `TraceQuickStats`
- `getQuickStats`
- `recordAttemptSnapshot`

---

## 6. Extraction plan

### Step 1. Move observation payload types
새 파일로 아래 type/export를 이동한다.

- `SquatCameraObservabilityExport`
- `SquatObservationEventType`
- `ObservationTruthStage`
- `SquatAttemptObservation`
- `OverheadObservationEventType`
- `OverheadAttemptObservation`

이 단계는 purely structural move여야 하며, type name / field name / literal union meaning은 변경 금지다. fileciteturn0file0L60-L67

### Step 2. Move squat observation builder cluster
새 파일로 아래 helper를 이동한다.

- `buildSquatCameraObservabilityExport`
- `computeObservationTruthFields`
- `relativeDepthPeakBucket`
- `readHighlighted`
- `deriveSquatObservabilitySignals`
- `squatDownwardCommitmentReachedObservable`
- `buildSquatAttemptObservation`
- `observationDedupSkip`
- `buildTopReasons` (minimum shared helper)

여기서 핵심은 “단일 함수 이동”이 아니라, squat observation output을 만드는 작은 cluster 이동이어야 한다는 점이다. 업로드 메모도 이를 가장 중요한 설계상 리스크로 명시했다. `buildSquatAttemptObservation`은 `buildSquatCameraObservabilityExport`, `deriveSquatObservabilitySignals`, `computeObservationTruthFields`, `buildTopReasons`에 깊게 묶여 있어 일부만 떼면 경계가 깨진다. fileciteturn0file0L123-L129

### Step 3. Move overhead observation builder cluster
새 파일로 아래 helper를 이동한다.

- `buildOverheadAttemptObservation`
- `overheadObservationDedupSkip`

overhead는 squat보다 cluster가 얇지만, dedup까지 같은 파일로 옮겨야 observation builder ownership이 분명해진다. fileciteturn0file0L71-L74

### Step 4. Keep public surface in `camera-trace.ts`
기존 exported 함수명, import path, response shape는 그대로 유지한다. 즉 외부 consumer는 동일하게 `camera-trace.ts`를 import하고, 내부 구현만 새 builder 파일로 delegate하게 만든다. 이는 external import churn을 최소화하기 위한 필수 원칙이다. fileciteturn0file0L97-L101

---

## 7. Locked truth outputs

이번 PR은 behavior-preserving extraction only다. 따라서 아래 truth outputs는 RF-04 전후 완전히 동일해야 한다.

- `buildSquatCameraObservabilityExport(gate)` 결과
- `buildSquatAttemptObservation(gate, eventType, options)` 결과
- `buildOverheadAttemptObservation(gate, attemptCorrelationId, eventType, options)` 결과
- `observationDedupSkip` 결과
- `overheadObservationDedupSkip` 결과
- `recordSquatObservationEvent`의 no-throw / non-blocking semantics
- `recordOverheadObservationEvent`의 no-throw / non-blocking semantics
- observation count semantics
- terminal snapshot 직전 squat observation snapshot fallback semantics
- trace가 sink-only observability layer라는 성격

이는 업로드된 RF-04 메모의 truth output 잠금과 동일하다. fileciteturn0file0L114-L122

추가로 부모 리팩토링 SSOT의 camera observability invariants도 그대로 유지해야 한다.

- trace는 판정을 바꾸지 않는다.
- localStorage 실패는 카메라 플로우를 깨뜨리면 안 된다.
- observation / success snapshot / attempt snapshot은 읽기용 진단 surface다.
- trace schema는 첫 단계 리팩토링에서 유지한다. fileciteturn0file1L87-L90 fileciteturn0file1L201-L205

---

## 8. Non-goals

이번 PR에서 아래는 절대 하지 않는다.

- trace payload field명 변경
- observation payload schema 변경
- `debugVersion` 산식 변경
- `buildSquatAttemptObservation` 출력 의미 변경
- `buildOverheadAttemptObservation` 출력 의미 변경
- dedup timing semantics 변경
- `recordSquatObservationEvent` / `recordOverheadObservationEvent` swallow semantics 변경
- storage key / storage policy 변경
- `buildDiagnosisSummary` 변경
- `buildAttemptSnapshot` 의미 변경
- `getQuickStats` split 동시 진행
- export payload redesign
- trace를 runtime 판정 입력으로 읽는 새 경로 추가

이는 RF-04 메모의 절대 비목표와 부모 SSOT의 camera-trace non-goals를 그대로 따른다. fileciteturn0file0L102-L107 fileciteturn0file1L201-L205

---

## 9. Why this extraction is behavior-preserving

이 PR은 observation layer를 분리하는 구조 정리 PR이다. observation layer는 runtime truth owner가 아니라 sink-only observability layer이므로, 이 단계에서 허용되는 변화는 코드 위치와 파일 경계뿐이다. 제품 truth, pass truth, UI progression, capture quality, blocked reason, session contract 같은 운영 의미는 바꾸지 않는다. 부모 SSOT도 모든 초기 리팩토링은 “출력 truth를 보존하는 구조 분리형 리팩토링”이어야 하며, 동일 fixture/동일 smoke에서 핵심 truth output이 같아야 한다고 명시한다. fileciteturn0file1L21-L25 fileciteturn0file1L45-L57

RF-04는 특히 trace schema redesign이나 diagnosis split이 아니라, builder cluster를 더 명확한 파일 경계로 이동시키는 것이다. 따라서 이 PR이 성공하려면 새 파일이 “같은 입력 → 같은 observation payload”를 만들어야 하고, `camera-trace.ts`는 단지 public surface를 유지한 얇은 delegate로 남아야 한다. 이것이 behavior-preserving extraction의 핵심이다.

---

## 10. Regression proof

### A. Builder parity compare
동일 fixture gate / 동일 options 입력으로 pre/post 완전 비교.

- `buildSquatCameraObservabilityExport`
- `buildSquatAttemptObservation`
- `buildOverheadAttemptObservation`

### B. Dedup parity
동일 list + next observation 입력으로 pre/post 결과 동일성 확인.

- `observationDedupSkip`
- `overheadObservationDedupSkip`

### C. Record helper parity
예외 삼킴 / non-blocking semantics 유지 확인.

- `recordSquatObservationEvent`
- `recordOverheadObservationEvent`

### D. Storage interaction parity
storage를 바꾸지 않더라도 builder payload가 storage로 흘러가기 때문에 아래 간접 확인이 필요하다.

- squat observation count 동일
- overhead observation count 동일
- `getRecentSquatObservationsSnapshot()`의 terminal bundle 의미 동일

이 검증 항목은 RF-04 메모의 최소 회귀 검증 기준을 그대로 따른다. fileciteturn0file0L114-L122 fileciteturn0file0L123-L129

### E. Camera sanity
부모 SSOT의 merge gate에 따라 관련 smoke와 실기기 sanity 1회 이상을 요구한다. trace 리팩토링이라도 camera flow non-blocking 특성이 깨지면 안 된다. fileciteturn0file1L327-L334

---

## 11. Residual risks

### Risk 1. Hidden cycle risk
새 builder 파일이 `camera-trace.ts`를 다시 import하게 되면 cycle이 생길 수 있다. 이 경우 boundary를 줄이는 대신, builder에 직접 필요한 최소 shared helper를 새 파일로 함께 이동하는 방식으로 해결해야 한다. RF-04 메모는 이 점에서 `buildTopReasons` 이동을 권장한다. fileciteturn0file0L76-L87

### Risk 2. Partial-cluster extraction risk
`buildSquatAttemptObservation`만 단독 이동하고 supporting helper를 남겨두면, 향후 ownership이 더 모호해질 수 있다. 이번 PR은 function-by-function move가 아니라 cluster move여야 한다. fileciteturn0file0L123-L129

### Risk 3. Shared use of `buildSquatCameraObservabilityExport`
이 helper는 squat observation 행과 attempt snapshot 양쪽에 모두 쓰인다. 따라서 어디에 두는지가 RF-04의 핵심 경계다. 권장안은 observation builder cluster로 보고 RF-04에서 새 파일로 같이 이동하되, diagnosis summary split은 하지 않는 것이다. fileciteturn0file0L129-L136

### Risk 4. Over-refactor temptation
RF-04 수행 중 diagnosis/export/quick-stats까지 같이 건드리면 PR 성격이 바뀐다. 부모 SSOT의 “One PR = one layer” 규칙상 금지다. fileciteturn0file1L47-L49

---

## 12. Follow-up PRs

RF-04 다음 순서는 부모 SSOT와 업로드 메모 기준으로 아래가 맞다.

1. RF-05가 아니라, camera-trace 도메인 안에서는 먼저 diagnosis summary split
2. 그다음 quick stats / export split
3. 이후 camera-trace 상위 surface 정리 완료

부모 SSOT의 locked extraction order도 `B2 observation builders split → B3 diagnosis summary split → B4 quick stats / export utilities split` 순서를 고정하고 있다. fileciteturn0file1L194-L200

### Proposed next PR names
- `PR-RF-05 — camera-trace.ts diagnosis summary split`
- `PR-RF-06 — camera-trace.ts quick stats / export utilities split`

단, 저장소 전체 추천 순서에서는 session/readiness 리팩토링 번호 체계와 충돌하지 않도록 실제 PR 번호는 팀 규칙에 맞게 조정할 수 있다. 중요한 것은 camera-trace 내부 단계 순서가 storage → observation → diagnosis → quick-stats/export라는 점이다.

---

## 13. One-line lock

> RF-04는 `camera-trace.ts`에서 observation record를 만드는 builder cluster만 분리하는 PR이다. storage 이후, diagnosis 이전 단계이며, trace의 sink-only observability 성격과 observation payload truth는 절대 바꾸지 않는다.
