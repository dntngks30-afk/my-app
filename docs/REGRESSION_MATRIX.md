역할: public → pay → app 퍼널 회귀를 막기 위한 검증 매트릭스 문서. 시나리오별 필수 확인 항목을 정의한다.

# REGRESSION_MATRIX.md

## Documentation precedence

문서 스택 6순위. 충돌 시 더 상위 문서가 우선한다.

1. `docs/SSOT_PUBLIC_FIRST_2026_03.md`
2. `AGENTS.md`
3. `ARCHITECTURE.md`
4. `SYSTEM_FLOW.md`
5. `DEVELOPMENT_RULES.md`
6. **docs/REGRESSION_MATRIX.md** (본 문서)
7. `docs/KNOWN_RISKS_AND_OPEN_ITEMS.md`

---

## 0. Goal
이 문서의 목적은 public-first 구조와 앞으로의 단일-entry / optional-camera / simplified-result / execution-unlock funnel에서 회귀를 막는 것이다.

검증 대상은 단순 렌더링이 아니라 아래다:
- route continuity
- result continuity
- auth/pay continuity
- claim continuity
- session create validity
- app entry continuity

---

## 1. Critical scenario groups

### Scenario 1. Single-entry -> survey baseline -> result
목표:
- 단일 entry CTA에서 free survey baseline result까지 정상 도달

검증:
- entry에서 설문/카메라 2분기 강요가 없는지
- pre-survey 최소 입력이 정상 저장되는지
- survey 완료 후 baseline result가 생성되는지
- auth 없이도 public result가 persistence 가능한지

Expected:
- result open success
- public_result_id or equivalent continuity 확보
- raw internal debug가 사용자 surface에 과노출되지 않음

---

### Scenario 2. Survey baseline -> skip camera -> result
목표:
- camera 없이도 결과 흐름이 완성되는지

검증:
- 결과 직전 camera optional 제안이 뜨는지
- “결과 먼저 보기” 선택 시 결과가 열리는지
- camera를 안 했다고 막히지 않는지

Expected:
- result open success without camera
- baseline continuity 유지
- conversion CTA 동작 가능

---

### Scenario 3. Survey baseline -> camera refine -> refined result
목표:
- camera가 optional refine로 작동하는지

검증:
- survey 완료 후 camera bridge 진입
- camera 이후 refined result open
- baseline continuity가 끊기지 않는지
- camera를 별도 독립 결과처럼 취급하지 않는지

Expected:
- refined result available
- same public flow continuity 유지
- result messaging가 still action-oriented

---

### Scenario 4. Result simplification UX
목표:
- 결과가 2~3 screen action-oriented 구조인지

검증:
- 타입 설명
- 왜 이런지 / 조심할 움직임
- 추천 운동/생활습관/운동 순서 preview
- confidence/raw axes/priority vector가 과도하게 노출되지 않는지

Expected:
- result is understandable without internal scoring knowledge
- CTA가 자연스럽게 execution preview로 이어짐

---

### Scenario 5. Result -> login continuity
목표:
- 로그인 후 / 또는 의미 없는 루트 복귀가 없는지

검증:
- result에서 실행 시작 클릭
- login 진행
- login 후 원래 의도 경로 복귀
- moveReBridgeContext:v1 또는 equivalent continuity 유지

Expected:
- no **의도 없는** 마케팅 루트(`/`) redirect (허용된 `next`/bridge/앱 경로는 계약에 따름)
- intended path restored
- pending result continuity survives

---

### Scenario 6. Result -> signup continuity
목표:
- signup / signup-complete를 거쳐도 intent가 유지되는지

검증:
- result에서 실행 시작 클릭
- signup 진입
- signup-complete까지 next 유지
- 완료 후 intended path 복귀

Expected:
- no unexpected "/" redirect
- next preserved across signup and signup-complete
- result/pay bridge continuity 유지

---

### Scenario 7. Email OTP continuity
목표:
- email OTP 링크를 통해도 same continuity가 유지되는지

검증:
- emailRedirectTo에 signup/complete?next=... 반영 여부
- 링크 클릭 후 signup/complete 진입
- 완료 후 intended path 도달

Expected:
- OTP path still preserves next
- no context drop

---

### Scenario 8. Result -> pay continuity
목표:
- auth 이후 pay/checkout로 자연스럽게 이어지는지

검증:
- execute intent 저장
- auth 완료 후 pay bridge or checkout 연결
- 홈으로 샌드백처럼 보냈다가 다시 돌아오게 하지 않는지

Expected:
- pay continuity preserved
- user does not feel "I have to start over"

---

### Scenario 9. Post-pay onboarding minimal flow
목표:
- 결제 후 onboarding이 짧고 필요한 정보만 받는지

검증:
- 주당 빈도
- 최근 운동 경험
- 불편부위/통증 여부
- 질환/수술/제한 여부
- pre-survey에서 이미 받은 나이/성별 재질문 없는지

Expected:
- onboarding steps stay minimal
- no redundant questions

---

### Scenario 10. Onboarding -> claim -> session create
목표:
- claim과 create가 끊김 없이 이어지는지

검증:
- onboarding complete
- claim starts
- claim complete before app entry
- session create uses claimed public result
- readiness next_action transitions correctly

Expected:
- no claim race
- no app entry before claim complete
- create_session succeeds

---

### Scenario 11. New-account plan generation
목표:
- 새 계정에서 empty plan 재발이 없는지

검증:
- session create outcome
- bootstrap exercise_count > 0
- plan-summary segments.length > 0
- template lookup not zero due to scoring key mismatch

Expected:
- non-empty plan generated

---

### Scenario 12. Historical empty-draft recovery
목표:
- 과거 오염 draft가 valid plan처럼 재사용되지 않는지

검증:
- 계정에 segments=[] draft 존재
- session create trigger
- broken draft reuse 차단
- regeneration 성공
- 새 plan non-empty

Expected:
- invalid draft falls through to regeneration

---

### Scenario 13. preview_ready semantics
목표:
- preview_ready가 started처럼 재제출되지 않는지

검증:
- preview_ready flow 재진입
- preview submit 차단 여부
- started flow만 submit candidate인지

Expected:
- no preview 422 due to wrong state consumption
- state semantics preserved

---

### Scenario 14. Bootstrap source alignment
목표:
- bootstrap과 session create가 같은 truth를 읽는지

검증:
- public-result source alignment
- legacy fallback behavior
- exercise_count / plan-summary / readiness consistency

Expected:
- no hidden mismatch between create and read paths

---

### Scenario 15. Session generation staged UX
목표:
- generation screen이 가짜처럼 느껴지지 않는지

검증:
- 1.5~3초 수준
- 실제 처리와 loosely aligned copy
- 지나치게 긴 고정 delay 없음

Expected:
- believable staged generation experience

---

### Scenario 16. PWA install guide
목표:
- session create 직후 install guide가 짧고 유효한지

검증:
- 링크 복사
- 크롬 열기 안내
- 사파리 열기 안내
- 홈 화면 추가 안내

Expected:
- install prompt is helpful, not blocking

---

### Scenario 17. App first-run tutorial
목표:
- /app/home 첫 튜토리얼이 최소형인지

검증:
- 세션 패널 설명
- 재생 버튼 설명
- 플레이어 흐름 설명
- 그 이상 장황한 설명 없음

Expected:
- user can quickly start first routine

---

## 2. Required validation outputs
각 시나리오에서 최소 아래를 기록한다.

- entry path
- result type / continuity
- next path / redirect outcome
- bridge context survival
- readiness next_action
- claim outcome
- session create outcome
- bootstrap exercise_count
- plan-summary segments length
- unexpected **의도 없는 `/`** redirect 여부
- 사용자가 “다시 처음부터”라고 느낄 지점이 있었는지

---

## 3. Minimum regression pack before merge
아래는 최소 병합 전 검증 팩이다.

1. single-entry -> survey -> result
2. survey -> skip camera -> result
3. survey -> camera -> refined result
4. result -> login -> pay continuity
5. result -> signup -> signup-complete continuity
6. email OTP continuity
7. post-pay onboarding minimal flow
8. onboarding -> claim -> create
9. new-account non-empty plan
10. historical empty-draft recovery
11. preview_ready semantics
12. bootstrap/public-result source alignment
13. session generation staged UX smoke
14. app first-run tutorial smoke