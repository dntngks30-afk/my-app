# ARCHITECTURE.md

## Documentation precedence

문서 스택 3순위. 충돌 시 더 상위 문서가 우선한다.

1. `docs/SSOT_PUBLIC_FIRST_2026_03.md`
2. `AGENTS.md`
3. **ARCHITECTURE.md** (본 문서)
4. `SYSTEM_FLOW.md`
5. `DEVELOPMENT_RULES.md`
6. `docs/REGRESSION_MATRIX.md`
7. `docs/KNOWN_RISKS_AND_OPEN_ITEMS.md`

본 문서의 각 절은 **CURRENT_IMPLEMENTED** / **LOCKED_DIRECTION** / **NOT_YET_IMPLEMENTED**를 섞지 않도록 표기한다. 최상위 canonical은 SSOT다.

---

## 0. 문서 목적
이 문서는 MOVE RE의 계층 구조와 각 계층의 책임을 정의한다.  
구현 세부보다 **무엇이 어디의 책임인지**, **무엇이 truth인지**, **어떤 계층끼리 섞이면 안 되는지**를 명확히 하는 것이 목적이다.

---

## 1. Core identity

MOVE RE는 운동 콘텐츠 앱이 아니다.  
MOVE RE는 정적 추천 라이브러리도 아니다.  
MOVE RE는 상태 기반 운동 실행 시스템이다.

핵심 구조:
analysis  
-> interpretation  
-> readiness  
-> session creation  
-> execution  
-> logging  
-> adaptation  
-> next session

---

## 2. Architectural shift

### Old (deprecated narrative — 문서·히스토리 구분용)
`payment → in-app deep test → result → session creation → app execution`  
과거 **paid-first** 서술. 신규 설계의 기본 전제로 복귀하지 않는다.

### Current / Target
public analysis  
-> public result  
-> auth/pay  
-> onboarding  
-> claim  
-> session creation  
-> app execution

핵심 차이:
- 분석은 public에서 일어난다
- 결제는 실행을 연다
- 결과는 auth 이전에도 존재하고 저장된다
- auth 후에는 그 결과를 claim하여 실행으로 연결한다

---

## 3. Layer overview

### Layer 1. Public Entry Layer
책임:
- public 첫 진입 경험
- 단일 CTA 구조
- pre-survey 최소 입력 시작점

현재 truth:
- public analysis 진입 구조는 존재한다
- 그러나 entry presentation은 단일 입구 구조로 더 정리되어야 한다

Locked direction:
- 설문 / 카메라 2개 입구를 기본 UX로 두지 않는다
- 단일 entry CTA를 사용한다
- 예: "내 몸 상태 1분 체크하기"

---

### Layer 2. Baseline Survey Layer
책임:
- baseline analysis input 수집
- 결과 생성의 기본 바탕이 되는 정보 수집

권장 입력:
- 나이대
- 성별
- 운동 경험
- 현재 불편 부위 / 없음
- 추가 free survey 문항

현재 truth:
- free survey 기반 baseline result 생성 구조가 있다

Locked direction:
- 설문은 항상 baseline truth 생성의 중심이다

---

### Layer 3. Camera Refine Layer
책임:
- baseline 위에 움직임 evidence를 추가
- baseline result를 refine
- 더 적합한 시작점 해석 보조

현재 truth:
- camera는 Deep Result V2의 refine evidence 역할이다
- 독립적인 canonical result truth가 아니다

Locked direction:
- camera를 별도 입구로 밀지 않는다
- camera는 결과 직전 optional bridge로 제안한다
- camera는 진단처럼 보이면 안 된다

---

### Layer 4. Public Result Layer
책임:
- unified public result rendering
- public result persistence
- auth 이전 결과 continuity의 중심

현재 truth:
- public_results persistence/read/handoff는 구조적으로 존재한다
- Deep Result V2가 canonical analysis truth다

Locked direction:
- 결과는 복잡한 내부 score 노출이 아니라 행동 유도 중심
- 결과는 2~3 화면 중심
- “내 타입 / 왜 이런지 / 조심할 움직임 / 지금 할 것”에 집중
- conversion preview는 운동 추천보다 운동 순서 preview에 가깝게 간다

---

### Layer 5. Conversion / Auth / Pay Bridge Layer
책임:
- result -> execute intent 저장
- next path 유지
- auth continuity
- pay continuity
- pending public result continuity

현재 truth:
- result->auth/pay bridge 구조는 존재한다
- login/signup/signup-complete next continuity hardening이 들어갔다

Locked direction:
- auth 이후 **마케팅 루트(`/`)로 의도 없이만** 복귀시키지 않는다 (`next`·bridge·앱 홈 등 계약된 경로 — `SYSTEM_FLOW.md` 참고)
- 결과 컨텍스트를 유지한 채 pay/execute로 이어진다
- 가능하면 로그인 직후 다시 한 번 설명보다 pay bridge 또는 checkout으로 자연 연결한다

---

### Layer 6. Onboarding / Claim Layer
책임:
- authenticated user readiness input 수집
- anonymous public result를 user context에 claim
- claim 완료 전 /app 진입 차단

현재 truth:
- onboarding / claim 연결은 구조적으로 완료되었다
- claim race 완화가 들어가 있다

Locked direction:
- onboarding은 짧고 피로하지 않게 유지
- pre-survey에서 이미 받은 입력은 재질문하지 않는다
- 결제 직후 onboarding은 최소 3~4 step 수준으로 관리

---

### Layer 7. Session Readiness Layer
책임:
- 현재 유저가 해야 할 next_action 계산
- session create 가능 여부 / app open 가능 여부 결정
- route-level progression gating

Canonical next_action examples:
- login
- pay
- claim_result
- complete_onboarding
- create_session
- open_app
- blocked

현재 truth:
- readiness는 이미 canonical progression truth다

Locked direction:
- readiness ownership을 흩뜨리지 않는다
- bootstrap, auth, claim, create, app entry가 readiness와 충돌하면 readiness contract를 우선한다

---

### Layer 8. Session Creation Layer
책임:
- claimed public result + onboarding 기반 세션 생성
- valid idempotency
- invalid draft recovery

현재 truth:
- session create의 primary source는 claimed public result다
- legacy paid deep는 fallback only다
- empty draft reuse 차단이 들어갔다
- selected current public result truth는 result layer에서 끝나지 않고 session creation까지 연속된다
- session 1은 selected current state truth의 continuation으로 체감되어야 한다

Critical ownership rule:
- analysis engine identifier와 template selection key는 분리되어야 한다

금지:
- compat metadata를 template-pool selector처럼 직접 사용
- `Prep` semantics가 `Main` semantics를 silently dominate하는 composition

---

### Layer 8.1 Selected-truth trace layer (PR4 lock)
책임:
- selected truth를 canonical trace로 설명
- what truth won / why won / 어떤 fallback layer였는지 기록

Canonical block:
- `selected_truth_trace`

Required fields (개념):
- source_mode
- truth_owner
- public_result_id + stage
- selected timestamps (claimedAt / createdAt)
- fallback_reason + fallback_layer

Boundary:
- selected truth 설명 계층이며 realized alignment 판정 계층이 아니다.

### Layer 8.2 Alignment audit layer (PR3 lock)
책임:
- 생성 output이 selected truth를 honor했는지 machine-audit
- phase-semantic drift(특히 Prep→Main 잠식) 여부를 감시

Canonical block:
- `alignment_audit`

Boundary:
- realized alignment 판정 계층이며 selected truth source 설명 계층이 아니다.

### Layer 8.3 Boundary law (anti-conflation)
- `selected_truth_trace` = what truth won and why
- `alignment_audit` = whether output honored that truth
- 두 블록을 합치거나 의미를 교차 재해석하지 않는다

---

### Layer 9. Session Generation Feedback Layer
책임:
- 세션 생성 중 UX
- staged progress 표현
- “가짜처럼 느껴지지 않는” 생성 경험 제공

현재 truth:
- 이 레이어는 fully polished 상태가 아니다

Locked direction:
- 1.5~3초 수준의 staged generation UX 사용
- 실제 처리 단계와 어느 정도 대응하는 문구 사용
- 지나치게 긴 fake loading 금지

---

### Layer 10. Install Continuation Layer
책임:
- 세션 생성 후 PWA 설치 안내
- 인앱 브라우저 우회
- 홈 화면 추가 유도

현재 truth:
- PWA 관련 구조는 존재한다
- 하지만 timing과 copy는 더 정리될 필요가 있다

Locked direction:
- install CTA의 핵심 타이밍은 session generation 직후
- 링크 복사, 크롬/사파리 열기, 홈 화면 추가 안내를 짧게 제공

---

### Layer 11. App First-Run Guidance Layer
책임:
- /app/home 첫 진입 최소형 튜토리얼
- 세션 패널 / 재생 / 플레이어 흐름 이해

현재 truth:
- execution core는 존재한다
- first-run tutorial minimal flow는 polish 대상이다

Locked direction:
- 설명보다 바로 실행 중심
- 튜토리얼은 3포인트 이내
- 세션 패널 / 재생 버튼 / 플레이어 흐름만 설명

---

### Layer 12. App Execution Layer
책임:
- session delivery
- execution
- logging
- adaptation
- next session

현재 truth:
- MOVE RE의 /app execution core는 기존 핵심 자산이다

Boundary:
- public-entry/auth/handoff 작업 중 이 레이어를 불필요하게 흔들지 않는다

---

## 4. Canonical ownership rules

### Analysis truth
Deep Result V2

### Session create input truth
Claimed public result + onboarding

### Route progression truth
Readiness

### Result continuity truth
public result persistence + bridge context + next intent continuity

### Invalid plan recovery truth
empty/missing segments draft -> invalid -> regenerate

---

## 5. Anti-drift rules

1. paid-first 가정을 다시 도입하지 않는다
2. camera를 별도 truth 또는 별도 **공개 입구**처럼 만들지 않는다 (optional refine만)
3. result complexity를 다시 높이지 않는다
4. auth 이후 **의도 없이** 마케팅 루트(`/`)로만 복귀시키지 않는다
5. compatibility metadata를 canonical execution selector처럼 쓰지 않는다
6. bootstrap과 create가 서로 다른 truth를 조용히 읽게 두지 않는다
7. generation/loading을 완전 fake 연출로 만들지 않는다
8. app 첫 진입에서 긴 설명형 onboarding을 추가하지 않는다

---

## 6. Current architecture priorities

### P0
- single-entry public funnel architecture
- result-before-camera bridge
- result simplification architecture
- continuity lock from result -> auth -> pay -> onboarding -> claim

### P1
- readiness/bootstrap/source alignment
- preview_ready state semantics
- generation feedback layer
- install continuation layer
- first-run guidance layer

### P2
- conversion preview refinement
- camera refine presentation polish
- ops cleanup for historical polluted drafts
