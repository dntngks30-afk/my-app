역할: 현재 저장소의 핵심 리팩토링 대상을 안전하게 분해하기 위한 최상위 리팩토링 SSOT 문서. 이 문서는 기능 추가 문서가 아니라, **회귀 없이 구조를 정리하기 위한 기준 문서**다.

# REFACTORING_SSOT_2026_04.md

## Documentation precedence

리팩토링 문서는 기존 제품 SSOT를 덮어쓰지 않는다. 충돌 시 아래 우선순위를 따른다.

1. `docs/SSOT_PUBLIC_FIRST_2026_03.md`
2. `AGENTS.md`
3. `ARCHITECTURE.md`
4. `SYSTEM_FLOW.md`
5. `DEVELOPMENT_RULES.md`
6. `docs/REGRESSION_MATRIX.md`
7. `docs/KNOWN_RISKS_AND_OPEN_ITEMS.md`
8. **`docs/REFACTORING_SSOT_2026_04.md`** (본 문서)

즉, 본 문서는 제품 방향이나 실행 truth를 새로 정하는 문서가 아니다. 이미 잠긴 제품 truth를 **코드 구조 차원에서 안전하게 보존하면서 분해하는 규칙 문서**다.

---

## 0. Goal

이 문서의 목표는 아래 네 가지를 동시에 달성하는 것이다.

1. 현재 repo의 고위험 과밀 파일을 식별하고 우선순위를 잠근다.
2. 리팩토링 과정에서 **동작 변화 없이 분해**하는 원칙을 잠근다.
3. 회귀가 가장 위험한 truth surface를 명시하고, 각 PR이 무엇을 절대 바꾸면 안 되는지 고정한다.
4. 이후 모든 세부 리팩토링 PR 문서가 이 문서를 상위 기준으로 참조하게 만든다.

본 문서의 핵심 관점은 다음 한 줄이다.

> 지금 필요한 것은 기능 개선형 리팩토링이 아니라, **출력 truth를 보존하는 구조 분리형 리팩토링**이다.

---

## 1. Current top refactoring targets (priority locked)

현재 기준 핵심 리팩토링 대상 우선순위는 아래와 같이 잠근다.

### P0. `src/lib/camera/auto-progression.ts`
가장 위험한 과밀 파일. 카메라 pass truth / UI progression gate / failure reason / debug surface / observability가 한 파일에 과도하게 집중되어 있다.

### P1. `src/lib/camera/camera-trace.ts`
trace / observation / diagnosis / localStorage 저장 / quick stats / export surface가 하나의 거대 파일에 집중되어 있다. 관측 레이어가 운영 로직과 너무 가까워질 위험이 있다.

### P2. `src/app/api/session/create/route.ts`
public result / legacy deep / progress / adaptive / generation / persistence / idempotency가 한 route에 과밀하게 들어가 있다. 제품 구조가 커질수록 source-of-truth split-brain 위험이 커진다.

### P3. `src/lib/readiness/get-session-readiness.ts` + `session/create`의 중복 입력 판정 축
readiness와 create가 유사한 analysis input truth를 각각 계산하고 있다. 현재는 같은 방향이지만, 장기적으로 경로가 어긋날 수 있다.

### P4. 디버그 surface / dev-only 패널 / 관측 저장 경계
`TraceDebugPanel.tsx` 자체가 즉시 위험 파일은 아니지만, debug surface가 준-계약처럼 굳어질 가능성이 있다. trace를 도구가 아닌 제품 레이어처럼 키우지 않도록 경계를 다시 잠가야 한다.

이 우선순위는 이후 세부 리팩토링 PR 설계의 기준이 된다.

---

## 2. Refactoring philosophy (absolute rules)

### Rule 1. Behavior-preserving extraction first
첫 단계 리팩토링은 절대 “개선”이 아니다. 먼저 해야 하는 것은 아래 둘뿐이다.

- 파일 분리
- 함수 추출

즉, 첫 PR들은 구조만 바꾸고 로직은 바꾸지 않는다. 기존 조건문 순서, 반환값, 필드명, threshold, status mapping, block reason을 유지해야 한다.

### Rule 2. One PR = one layer
한 PR에서 둘 이상의 truth layer를 동시에 건드리지 않는다.

예시:
- UI gate 분리 PR에서 completion truth를 수정하면 안 된다.
- trace storage 분리 PR에서 diagnosis schema를 바꾸면 안 된다.
- readiness/create 공용화 PR에서 onboarding 판정까지 함께 바꾸면 안 된다.

### Rule 3. No hidden logic change inside cleanup
가독성 개선, 네이밍 정리, import 정리, helper 추출이라는 이름으로 threshold / branching / fallback / source priority / gate ordering을 바꾸면 안 된다.

### Rule 4. Truth outputs must stay identical before and after extraction
리팩토링 전/후에 동일 fixture / 동일 smoke / 동일 실기기 시나리오에서 핵심 truth output이 같아야 한다. 다르면 그 PR은 구조 정리가 아니라 로직 변경 PR이다.

### Rule 5. Debug/observability is sink-only
trace / observation / diagnosis layer는 판정을 만드는 레이어가 아니라 **관측용 sink**다. 운영 로직이 trace surface를 다시 입력으로 읽는 구조를 늘리지 않는다.

### Rule 6. Route handlers must become thin orchestrators
route는 auth + parse + orchestration + response 정도만 남기고, 실제 판단은 service/resolver 레이어로 이동해야 한다. 다만 첫 단계에서는 behavior-preserving extraction만 허용한다.

---

## 3. Locked non-goals

이번 리팩토링 묶음에서 아래는 목표가 아니다.

1. 카메라 pass quality 향상
2. squat / overhead threshold 조정
3. 새로운 camera evaluator 도입
4. readiness 상태 enum 변경
5. session create 계약 변경
6. public-first funnel 의미 변경
7. adaptive 정책 변경
8. debug export schema redesign

이 문서 기준 리팩토링은 **구조 정리**가 목적이지, 제품 로직 개선이 목적이 아니다.

---

## 4. Absolute invariants by domain

### 4.1 Camera domain invariants
아래 truth는 리팩토링 중 절대 바꾸면 안 된다.

- `completionSatisfied`
- `completionPassReason`
- `completionBlockedReason`
- `finalPassEligible`
- `finalPassBlockedReason`
- `passOwner`
- `finalSuccessOwner`
- `uiProgressionAllowed`
- `uiProgressionBlockedReason`
- `passConfirmationSatisfied`
- `captureQuality`

특히 squat에서 다음 분리는 유지되어야 한다.

- completion owner truth
- UI progression gate
- final-pass UI-only blockers
- observability/debug stamping

즉, 리팩토링은 이 분리를 **파일 구조에 반영**해야 하지만, 의미를 바꾸면 안 된다.

### 4.2 Camera observability invariants
아래 원칙을 유지한다.

- trace는 판정을 바꾸지 않는다.
- localStorage 실패는 카메라 플로우를 깨뜨리면 안 된다.
- observation / success snapshot / attempt snapshot은 읽기용 진단 surface일 뿐이다.
- trace schema는 첫 단계 리팩토링에서 유지한다.

### 4.3 Session create invariants
아래 truth는 리팩토링 중 절대 바꾸면 안 된다.

- active session idempotency
- empty draft recovery 의미
- claimed public result 우선, legacy deep fallback 순서
- daily limit / program finished blocking 순서
- onboarding minimum completeness 요구 축
- existing progress sync의 안전 조건
- adaptive merge 결과 의미
- summary response shape

### 4.4 Readiness invariants
아래는 리팩토링 중 유지해야 한다.

- unauthenticated → `needs_auth`
- inactive plan → `needs_payment`
- analysis input 없음 → `needs_result_claim`
- onboarding incomplete → `needs_onboarding`
- active session 존재 → `session_already_created`
- program finished / daily limit → `execution_blocked`
- create 가능 → `ready_for_session_create`

또한 readiness와 create가 analysis input을 읽는 순서는 장기적으로 공용화 대상이지만, 첫 단계에서는 **현재 의미를 유지한 채 추출만** 허용한다.

---

## 5. Target-by-target refactoring SSOT

## 5.A `src/lib/camera/auto-progression.ts`

### Problem statement
현재 이 파일은 카메라 실행 시스템의 여러 층을 한 파일에 담고 있다.

- pass truth read
- pass confirmation
- confidence / noise penalty
- squat UI gate
- squat final-pass blockers
- failure reasons
- user guidance
- debug surface construction
- observability enrichment
- final status mapping

이 구조는 다음 리스크를 만든다.

- 한 motion의 수정이 다른 motion에 회귀를 일으킬 수 있음
- truth layer와 debug layer의 경계가 코드상 명확하지 않음
- PR가 누적될수록 ownership을 추론하기 어려움
- “정리” 명목으로 로직이 슬며시 바뀔 위험이 큼

### Refactoring goal
기능 변화 없이 아래 물리적 층으로 분해한다.

1. pass/completion core readers
2. UI progression gate
3. final-pass blockers
4. failure reason / guidance helpers
5. debug / observability surface builders
6. top-level orchestration

### Locked extraction order
리팩토링 순서는 아래를 강제한다.

#### A1. Pure helper extraction only
먼저 아래 helper 그룹을 별도 파일로 추출한다.

- confidence / noise / metric read helpers
- failure reason helpers
- user guidance helpers
- pass confirmation helpers

이 단계에서는 top-level `evaluateExerciseAutoProgress`의 if/else 구조를 바꾸지 않는다.

#### A2. Squat UI gate isolation
다음으로 squat 전용 UI gate 계산을 `computeSquatUiProgressionLatchGate` 중심의 별도 파일로 분리한다.

이 단계에서도 아래는 절대 유지한다.

- owner truth source
- gate ordering
- blocked reason 문자열
- threshold 값

#### A3. Squat final-pass blocker isolation
`shouldBlockSquatUltraLowTrajectoryRescueShortCycleFinalPass` 및 `shouldBlockSquatUltraLowSetupSeriesStartFalsePassFinalPass` 등 UI-only blocker를 별도 파일로 이동한다.

이 단계에서는 completion truth를 절대 건드리지 않는다.

#### A4. Debug surface builder isolation
`SquatCycleDebug` 조립 / stamp / observability enrichment를 별도 builder로 이동한다.

이 단계의 원칙:
- debug field 값 불변
- debug field 삭제 금지
- debug field를 gate 입력으로 재사용하는 새 경로 추가 금지

#### A5. Final orchestration thinning
마지막에만 `evaluateExerciseAutoProgress`를 얇은 오케스트레이터로 만든다.

### Absolute non-goals for this target
- squat / overhead threshold 조정 금지
- easy path / low-ROM path 의미 변경 금지
- `finalPassBlockedReason` semantics 변경 금지
- guardrail / evaluator contract 변경 금지

### Required regression proof for each PR touching this target
- squat smoke
- overhead smoke
- final pass / blocked reason golden snapshot compare
- setup false-pass regression compare
- shallow squat regression compare
- overhead hold-pass regression compare

---

## 5.B `src/lib/camera/camera-trace.ts`

### Problem statement
현재 이 파일은 아래 기능이 모두 섞여 있다.

- attempt snapshot types/builders
- squat observation builders
- overhead observation builders
- localStorage storage / cache
- quick stats
- diagnosis summary builder
- success snapshot bridge
- export/clear surface helpers

이 구조는 다음 리스크를 만든다.

- trace가 운영 코드에 지나치게 가까워짐
- localStorage / export concerns가 domain logic와 섞임
- trace schema 유지 비용이 계속 증가함
- 훗날 누군가 trace 값을 runtime truth처럼 다룰 위험이 생김

### Refactoring goal
trace를 아래 레이어로 분리한다.

1. trace types / schemas
2. trace builders
3. localStorage persistence
4. diagnosis summary builders
5. observation event builders
6. quick stats / export helpers

### Locked extraction order
#### B1. Storage layer split first
`getObservationStorage`, key constants, push/get/clear 계열을 storage 파일로 이동한다.

#### B2. Observation builders split
squat / overhead observation builder를 별도 파일로 이동한다.

#### B3. Diagnosis summary split
attempt snapshot의 diagnosis summary / per-step summary / stability summary 조립을 별도 파일로 이동한다.

#### B4. Quick stats / export utilities split
`getQuickStats` 등 읽기 유틸을 마지막에 분리한다.

### Absolute non-goals for this target
- trace payload 필드명 변경 금지
- storage key 변경 금지
- export semantics 변경 금지
- trace를 runtime gate 입력으로 사용하는 새 경로 추가 금지

### Required regression proof
- trace export payload pre/post diff
- localStorage write failure 시 플로우 비파괴 확인
- latest attempt / squat observation / overhead observation count consistency
- success snapshot continuity 확인

---

## 5.C `src/app/api/session/create/route.ts`

### Problem statement
현재 route가 지나치게 많은 책임을 갖는다.

- auth
- request dedupe
- progress init / sync / cap block
- active session idempotency
- analysis input resolution
- used template accumulation
- adaptive signal load + merge
- plan generation cache
- DB persistence
- debug extras response

이 구조는 다음 리스크를 만든다.

- source-of-truth 판단 변경이 route 내부 분기와 얽혀 커짐
- public-first 전환 이후도 legacy fallback과 한 함수 안에서 충돌할 수 있음
- route 테스트가 어려워짐
- recovery/idempotency 경계가 흐려짐

### Refactoring goal
route를 얇은 오케스트레이터로 만들되, 첫 단계에서는 output과 순서를 유지한다.

### Locked extraction order
#### C1. Progress resolver split
progress init / sync / daily/program block / nextSessionNumber 계산을 resolver로 분리한다.

#### C2. Analysis input resolver split
claimed public result 우선 + legacy deep fallback을 공용 resolver로 추출한다.

#### C3. Adaptive resolver split
adaptive signal load / merge / overlay 계산을 별도 service로 분리한다.

#### C4. Persistence split
plan upsert / conflict recovery / progress active update를 별도 persistence helper로 분리한다.

#### C5. Response shaping split
summary response / debug extras shaping을 helper로 분리한다.

### Absolute non-goals for this target
- response contract 변경 금지
- claimed public vs legacy deep 우선순위 변경 금지
- daily/program block 순서 변경 금지
- empty draft recovery semantics 변경 금지
- adaptive merge logic 변경 금지

### Required regression proof
- new account non-empty plan
- historical empty draft recovery
- daily limit block
- program finished block
- claimed public result create path
- legacy deep fallback path
- bootstrap/public-result source alignment

---

## 5.D `src/lib/readiness/get-session-readiness.ts` and shared input truth

### Problem statement
readiness와 session create는 비슷한 analysis input truth를 각자 계산하고 있다. 지금은 우연히 맞지만, 장기적으로 수정 타이밍이 어긋나면 split-brain이 생길 수 있다.

### Refactoring goal
`resolveAnalysisInputTruth(userId)` 성격의 공용 read-only resolver를 만들고, readiness와 create가 같은 truth를 읽게 만든다.

### Locked migration order
#### D1. Shared resolver introduction
공용 resolver를 만들되, 아직 readiness/create 어느 쪽도 바꾸지 않는다. 기존 구현과 동일한 결과를 내는지 비교한다.

#### D2. Readiness adopts shared resolver
먼저 readiness만 공용 resolver를 사용하게 한다.

#### D3. Session create adopts shared resolver
그다음 session create를 공용 resolver로 바꾼다.

#### D4. Legacy duplicated logic removal
두 소비자가 모두 안정화된 뒤 중복 로직을 제거한다.

### Absolute non-goals for this target
- readiness status semantics 변경 금지
- `next_action.code` 변경 금지
- session create 입력 선택 우선순위 변경 금지

### Required regression proof
- readiness status matrix 동일성
- result claim required path 동일성
- onboarding required path 동일성
- ready_for_session_create 동일성
- session create source alignment 동일성

---

## 5.E Debug/dev-only surface boundary

### Problem statement
`TraceDebugPanel.tsx` 같은 dev-only surface는 유용하지만, 디버그 필드가 실제 준-계약처럼 굳어질 위험이 있다.

### Refactoring goal
운영 코드와 debug surface의 경계를 다시 분명히 한다.

### Locked rules
- dev-only panel은 runtime pass truth의 소유자가 아니다.
- debug field 추가는 운영 코드 입력 증가를 동반하면 안 된다.
- panel UI 리팩토링은 domain truth 리팩토링과 분리한다.
- debug surface는 가능하면 read-only import만 한다.

---

## 6. Standard PR template for all refactoring work

이 문서를 부모 SSOT로 참조하는 모든 리팩토링 PR 문서는 최소 아래 구조를 따라야 한다.

1. Scope
2. Non-goals
3. Locked truth outputs
4. Files changed
5. Why this extraction is behavior-preserving
6. Regression proof run
7. Residual risks
8. Follow-up PRs

그리고 모든 PR 문서 첫머리에 아래 문장을 포함한다.

> This PR follows `docs/REFACTORING_SSOT_2026_04.md` and is limited to behavior-preserving extraction unless explicitly stated otherwise.

---

## 7. Merge gates (mandatory)

리팩토링 PR은 기능 PR보다 더 보수적으로 병합해야 한다.

### Mandatory gates for camera refactor PRs
- 관련 smoke 통과
- pre/post golden snapshot compare 동일
- finalPassEligible / finalPassBlockedReason 동일
- completionPassReason / completionBlockedReason 동일
- 실기기 camera sanity 1회 이상

### Mandatory gates for session/readiness refactor PRs
- regression matrix 핵심 팩 재확인
- readiness status compare 동일
- session create output compare 동일
- public-result source alignment 확인
- new-account / empty-draft / daily-limit 시나리오 확인

---

## 8. What counts as a separate logic-change PR

아래 중 하나라도 발생하면 그 PR은 더 이상 리팩토링 PR이 아니다.

- threshold 변경
- blocked reason 변경
- next_action 변경
- source priority 변경
- idempotency semantics 변경
- trace schema 변경
- response contract 변경
- smoke expected output 변경

이 경우 문서는 본 SSOT 하위가 아니라 **별도 기능/로직 변경 PR 문서**로 분리해야 한다.

---

## 9. First recommended PR order

초기 추천 순서는 아래와 같이 잠근다.

1. PR-RF-01 — `auto-progression.ts` pure helper extraction
2. PR-RF-02 — `auto-progression.ts` squat UI gate isolation
3. PR-RF-03 — `camera-trace.ts` storage split
4. PR-RF-04 — `camera-trace.ts` observation builder split
5. PR-RF-05 — `session/create` analysis input resolver split
6. PR-RF-06 — readiness shared analysis truth adoption
7. PR-RF-07 — `session/create` orchestration thinning

원칙:
- 카메라에서 제일 위험한 core를 먼저 얇게 만든다.
- trace는 바로 삭제/축소하지 말고 storage와 builder부터 분리한다.
- readiness/create 공용 truth는 도메인 비교기가 준비된 뒤에만 건드린다.

---

## 10. Final lock

이 문서의 핵심 잠금은 아래 한 문장으로 요약된다.

> 리팩토링의 1차 목적은 구조 개선이 아니라 **회귀 없는 truth 보존**이다.

따라서 이후 세부 리팩토링은 모두 아래 질문에 통과해야 한다.

1. 이 PR은 구조만 바꾸는가?
2. 바뀐 출력 truth는 없는가?
3. 디버그/관측 레이어가 운영 truth에 더 가까워지지 않았는가?
4. 한 PR에 한 층만 건드렸는가?
5. regression proof가 충분한가?

하나라도 아니면, 그 PR은 본 문서의 범위를 벗어난다.
