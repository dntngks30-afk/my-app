역할: 현재 남아 있는 리스크, 미구현 항목, 주의할 함정을 정리하는 문서. 현재 truth와 open issues를 분리해 혼동을 줄인다.

# KNOWN_RISKS_AND_OPEN_ITEMS.md

## Documentation precedence

문서 스택 7순위(최하위). 위 1~6번과 충돌 시 **항상 상위 문서가 우선**한다.

1. `docs/SSOT_PUBLIC_FIRST_2026_03.md`
2. `AGENTS.md`
3. `ARCHITECTURE.md`
4. `SYSTEM_FLOW.md`
5. `DEVELOPMENT_RULES.md`
6. `docs/REGRESSION_MATRIX.md`
7. **docs/KNOWN_RISKS_AND_OPEN_ITEMS.md** (본 문서)

---

## 0. 문서 목적
이 문서는 “현재 구조가 무엇인가”를 설명하는 문서가 아니다.  
이 문서는 **현재 무엇이 아직 열려 있는가**, **어디서 실수하기 쉬운가**, **무엇을 먼저 막아야 하는가**를 정리한다.

---

## 1. Highest-priority risks

### P0. Single-entry migration drift
리스크:
- 단일 입구로 재정렬하는 과정에서 과거 2-entry 구조 흔적이 남아 사용자에게 다시 선택 피로를 줄 수 있다

증상 예:
- 첫 화면에서 설문/카메라가 동등한 입구처럼 보임
- camera를 안 하면 덜 정확하다고 느끼게 함
- baseline 없이 camera-only처럼 보이게 함

방지 원칙:
- entry는 1개
- 설문은 baseline
- camera는 결과 직전 optional refine

---

### P0. Result complexity creep
리스크:
- 결과를 단순화하는 과정에서 과거 내부 축/점수/priority 정보가 다시 과도하게 노출될 수 있다

증상 예:
- 내부 axis 설명이 너무 많음
- score/confidence가 사용자 surface 중심에 옴
- 사용자가 “그래서 내가 뭘 하면 되는지”를 놓침

방지 원칙:
- 타입
- 왜 이런지
- 조심할 움직임
- 지금 할 것
중심으로 유지

---

### P0. Auth/pay continuity regression
리스크:
- 로그인/회원가입/OTP/결제 연결에서 다시 intent가 끊길 수 있다

**CURRENT_IMPLEMENTED (완화됨, 회귀 감시):** AppAuthClient·`next`·`signup?next=`·`signup/complete?next=`·이메일 OTP `emailRedirectTo` 등으로 **의도 없는 마케팅 루트(`/`) 복귀**는 코드상 완화됨. 그러나 경로 추가·리팩터 시 **회귀 가능**하므로 regression matrix 시나리오로 계속 확인한다.

증상 예 (회귀 시):
- auth 후 **의도 없이** `/`만 보임
- 홈으로 먼저 보냈다가 맥락이 끊김
- bridge context 조기 소실
- pending result 유실

방지 원칙:
- result continuity를 auth/pay 이후에도 유지
- auth 이후 **의도 없는** 중간 복귀 금지
- execute intent / next path / pending result 유지

---

### P0. Regression lock missing
리스크:
- 한 군데 수정 후 다른 경로가 쉽게 깨질 수 있다

특히 취약한 축:
- survey-only 결과
- camera-refined 결과
- signup / OTP / login continuity
- claim / create
- empty draft recovery
- preview_ready state

방지 원칙:
- regression matrix를 최소 병합 기준으로 사용

---

## 2. Medium-priority risks

### P1. preview_ready 422 / state semantics
리스크:
- preview_ready가 started처럼 재소비되어 422 또는 state confusion이 재발할 수 있다

필요 조치:
- started vs preview_ready semantics 분리
- preview submit candidate를 명확히 제한

---

### P1. Bootstrap/public-result source misalignment
리스크:
- session create는 claimed public result를 보는데 bootstrap/read 경로가 legacy나 다른 source를 읽으면 UI와 실제 생성 truth가 어긋날 수 있다

증상 예:
- create는 성공했는데 bootstrap summary가 이상함
- exercise_count / segments / rationale가 엇갈림

필요 조치:
- create/read/bootstrap source selection 정합화

---

### P1. Post-pay onboarding bloat
리스크:
- 결제 후 onboarding이 길어지면 피로 누적으로 전환이 떨어진다

증상 예:
- 불필요한 재질문
- 너무 많은 단계
- 이미 아는 정보 재입력

원칙:
- 3~4 step
- 주당 빈도 / 운동 경험 / 불편부위 / 제한사항 정도로 최소화

---

### P1. Fake-feeling generation screen
리스크:
- 세션 생성 로딩이 과장되거나 너무 길면 가짜처럼 느껴진다

증상 예:
- 무조건 5~10초 고정
- 실제 처리와 무관한 progress 문구
- 이미 끝났는데 일부러 오래 기다리게 함

원칙:
- 1.5~3초 수준
- 실제 단계와 loosely aligned
- 길면 실제로 긴 것만큼만 기다리기

---

### P1. App first tutorial bloat
리스크:
- /app/home 첫 진입에서 장황한 튜토리얼이 붙으면 실행률이 떨어진다

원칙:
- 세션 패널
- 재생 버튼
- 플레이어 흐름
이 3개만

---

## 3. Lower-priority but important risks

### P2. Camera feels like a separate product
리스크:
- copy/UI가 잘못되면 camera가 baseline을 보강하는 옵션이 아니라 또 하나의 별도 제품처럼 느껴진다

원칙:
- optional refine
- diagnosis-like tone 금지

---

### P2. Conversion preview tone mismatch
리스크:
- “잠김” 같은 표현이 지나치게 앱/게임스럽고 프리미엄 execution 톤과 어긋날 수 있다

방향:
- 결제 후 바로 열림
- 개인 상태 반영 후 자동 구성
- 운동 순서까지 완성

---

### P2. Historical polluted empty drafts in ops
리스크:
- 구조는 고쳤더라도 과거 오염 row가 남아 운영상 혼란을 줄 수 있다

필요 판단:
- DB patch 필요 여부
- 관리자 도구 필요 여부
- 실계정 recovery 검증 범위

---

### P2. Error surfacing still weak
리스크:
- 또 다른 create failure가 나도 사용자 surface가 “운동 구성을 불러올 수 없음” 하나로 뭉개질 수 있다

방향:
- 주요 실패 유형 분리
- observability 강화
- 개발자 로그와 사용자 메시지 분리

---

## 4. Open implementation items

### Open Item A. Single-entry public UX
상태:
- 방향 잠김
- 전면 구현은 진행 필요

### Open Item B. Camera optional bridge before final result
상태:
- 방향 잠김
- 실제 bridge UX는 구현 과제

### Open Item C. Result IA simplification
상태:
- 방향 잠김
- 현재 renderer presentation 재정렬 필요

### Open Item D. Post-auth pay continuity polish
상태:
- next continuity hardening은 들어감
- auth 후 checkout/pay bridge로 즉시 이어지는 UX는 추가 polish 여지 있음

### Open Item E. Minimal onboarding refactor
상태:
- 구조는 있음
- 축소/정리 필요

### Open Item F. Session generation staged UX
상태:
- 필요성 잠김
- 실제 UX 도입 필요

### Open Item G. PWA install timing polish
상태:
- install 관련 자산은 있음
- 최적 타이밍/카피 polish 필요

### Open Item H. First-run tutorial minimization
상태:
- 필요 방향 잠김
- 실제 구현/정리 필요

### Open Item I. preview_ready semantics
상태:
- 남아 있는 contract issue

### Open Item J. bootstrap/source alignment
상태:
- 남아 있는 contract issue

---

## 5. Exit criteria for current phase
현재 phase를 “대체로 잠겼다”고 볼 수 있는 조건은 아래다.

1. public entry가 사실상 1개로 정리됨
2. survey baseline -> optional camera refine -> simplified result가 자연스럽게 이어짐
3. result -> auth -> pay continuity가 끊기지 않음
4. onboarding이 짧고 실행 중심
5. session create가 새 계정/오염 draft 모두에서 안정적
6. preview_ready / bootstrap source contract가 정리됨
7. generation / install / first tutorial이 짧고 자연스러움
8. regression matrix가 최소 병합 기준으로 작동함

---

## 6. Final reminder
현재 phase의 본질은 새로운 구조를 계속 발명하는 것이 아니다.  
현재 phase의 본질은:

- 이미 맞다고 확인된 public-first 구조를 유지하고
- 앞으로 잠근 단일-entry / baseline / optional refine / simple result / execution-first 방향을 구현하고
- 실제 사용자 퍼널을 끊김 없이 정합화하며
- 회귀를 봉인하는 것이다.