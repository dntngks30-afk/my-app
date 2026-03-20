역할: PR 설계 원칙, 작업 방식, scope 분리, 모델 선택 기준을 정의하는 문서. 에이전트가 어떻게 바꿔야 하는지를 통제한다.

# DEVELOPMENT_RULES.md

## Documentation precedence

문서 스택 5순위. 충돌 시 더 상위 문서가 우선한다.

1. `docs/SSOT_PUBLIC_FIRST_2026_03.md`
2. `AGENTS.md`
3. `ARCHITECTURE.md`
4. `SYSTEM_FLOW.md`
5. **DEVELOPMENT_RULES.md** (본 문서)
6. `docs/REGRESSION_MATRIX.md`
7. `docs/KNOWN_RISKS_AND_OPEN_ITEMS.md`

---

## 0. Core principle
현재 MOVE RE는 architecture-building 단계가 아니다.  
현재 MOVE RE는 **flow hardening + product direction execution + regression prevention** 단계다.

즉:
- 구조가 아예 없는 것을 새로 만드는 단계가 아니다
- 이미 잠긴 구조를 실제 사용자 기준으로 끊김 없이 연결하는 단계다
- 동시에 public UX를 단일 입구 / baseline / optional refine / simple result / execution-first로 재정렬하는 단계다

---

## 1. Mandatory status separation
모든 제안/PR/분석은 아래를 분리해서 써야 한다.

1. CURRENT_IMPLEMENTED
2. LOCKED_DIRECTION
3. NOT_YET_IMPLEMENTED

이 세 가지를 섞으면 안 된다.

예:
- “camera는 optional refine이다” -> CURRENT_IMPLEMENTED + LOCKED_DIRECTION
- “entry는 하나다” -> LOCKED_DIRECTION (아직 구현 중일 수 있음)
- “result 2~3 screen simplification” -> LOCKED_DIRECTION / NOT_YET_IMPLEMENTED
- “auth next continuity hardening” -> CURRENT_IMPLEMENTED

---

## 2. PR design rules

### Rule 1. PR은 좁고 단일 목적이어야 한다
한 PR에서 아래를 동시에 섞지 않는다.
- source-of-truth 수정
- state-machine 수정
- large UX redesign
- /app execution core 수정
- cleanup sweep

### Rule 2. Contract PR과 presentation PR을 분리한다
예:
- readiness/source selection/state semantics -> contract PR
- 결과 copy / 화면 정보 재배치 / staged loading copy -> presentation PR

### Rule 3. Public-entry 수정과 /app execution-core 수정을 섞지 않는다
정말 correctness 때문에 필요한 경우가 아니면 분리한다.

### Rule 4. 회귀 위험이 큰 경로는 문서와 테스트를 같이 잠근다
특히 아래:
- result -> auth
- auth -> pay
- pay -> onboarding
- onboarding -> claim
- claim -> session create
- create -> app entry

### Rule 5. broad cleanup은 live funnel bug fix와 섞지 않는다
실제 전환율에 직접 영향을 주는 퍼널 문제를 잡을 때는 범위를 좁힌다.

---

## 3. Required PR output sections
모든 구현 제안 또는 PR 프롬프트는 아래 순서를 지켜야 한다.

1. Assumptions
2. Findings
3. Root cause
4. Files to change
5. Why this is safe relative to SSOT
6. Acceptance tests
7. Explicit non-goals

필요 시 8. Rollback risk / migration notes 추가

---

## 4. Product-direction rules

### Rule A. Entry
기본 public entry는 하나여야 한다.  
설문/카메라 2개 분기 구조를 다시 default UX로 만들지 않는다.

### Rule B. Survey baseline
설문은 baseline result 생성의 기준이다.

### Rule C. Camera refine
카메라는 optional refine다.  
별도 독립 진단 경험처럼 만들지 않는다.

### Rule D. Result simplification
결과는 설명보다 행동 유도 중심으로 단순화한다.

금지:
- raw score를 그대로 전면 노출
- priority vector 과잉 노출
- 내부 axis를 사용자 UX의 중심에 두기

### Rule E. Payment meaning
결제는 분석 unlock이 아니라 실행 unlock이다.

### Rule F. Auth continuity
auth 이후 **마케팅 루트(`/`)로 의도 없이만** 튕기지 않게 한다. `next`/bridge/앱 홈 등 계약된 복귀를 깨지 않는다.

### Rule G. App first-run
첫 app 경험은 “설명”이 아니라 “바로 실행” 중심이다.

---

## 5. Contract rules

### Contract 1. Analysis engine vs execution selector separation
분석 엔진 식별자와 템플릿/세션 선택 키는 의미적으로 분리되어야 한다.

금지 예:
- compat.scoring_version을 그대로 template pool selector로 사용

### Contract 2. Compatibility metadata is not canonical truth
_compat는 compatibility metadata다.  
canonical execution truth가 아니다.

### Contract 3. Claimed public result is primary session-create source
legacy paid deep는 fallback only다.

### Contract 4. Readiness owns next_action
bootstrap, app entry, pay bridge, claim, create가 route progression을 제각각 결정하면 안 된다.

### Contract 5. Invalid draft reuse is forbidden
plan_json.segments가 없거나 빈 draft는 invalid다.  
재사용이 아니라 regeneration으로 보내야 한다.

---

## 6. UX implementation rules

### Result screens
- 2~3 screens를 기본
- 타입 / 이유 / 조심할 움직임 / 지금 할 것 중심
- 행동 유도 CTA가 명확해야 함

### Camera bridge
- 결과 직전에 optional refine로 제안
- “정확도 향상”보다 “조금 더 맞는 시작점” 표현 선호

### Onboarding
- 결제 후 3~4 step 수준
- 이미 받은 입력 재질문 금지

### Generation screen
- 1.5~3초 수준
- 완전 fake progress 금지
- 실제 단계와 loosely aligned copy 사용

### Install guide
- session create 직후
- 링크복사 / 크롬 / 사파리 / 홈 화면 추가만 짧게

### First tutorial
- 세션 패널 / 재생 / 플레이어
- 이외 장황한 설명 금지

---

## 7. Acceptance test philosophy
스모크 통과만으로 충분하다고 주장하지 않는다.  
특히 funnel 관련 작업은 아래를 같이 봐야 한다.

- route continuity
- state continuity
- pending result continuity
- bridge context continuity
- readiness next_action
- session create outcome
- bootstrap exercise_count / segments
- unexpected / redirect 여부

---

## 8. Model selection rules

### Use Sonnet 4.6 for
- source-of-truth changes
- state-machine changes
- auth/pay/claim continuity contracts
- readiness/bootstrap ownership
- idempotency / recovery logic
- session create source selection
- entry architecture ownership changes

### Use Composer for
- result copy simplification
- narrow UI wiring
- camera bridge copy/UI
- onboarding question reduction
- generation staged UX presentation
- install guide polish
- first tutorial minimal UI
- regression docs and checklists

---

## 9. Do-not-do list
- Do not revert to paid-first assumptions
- Do not hardcode marketing root `/` as the **only** auth-complete destination (의도 없는 `/` 복귀 금지; `next`/bridge 우선)
- Do not let public result disappear across auth/pay
- Do not reintroduce two equal public entry branches by default
- Do not overexpose internal analysis data in public result UX
- Do not hide structural errors with silent fallbacks
- Do not claim “fixed” unless current and target scope are both explicitly stated
- Do not merge funnel contract fixes with unrelated large refactors