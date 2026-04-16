역할: 현재 구현된 truth와 앞으로 잠근 public-first 제품 구조를 함께 관리하는 **최상위 canonical SSOT** 문서.

# SSOT: MOVE RE Public-First Transition + Product Direction Lock

Last updated: 2026-03-21  
Status: Canonical SSOT (문서 7종 중 1순위)

---

## Documentation precedence

문서 간 충돌 시 **번호가 작을수록 우선**한다.

1. `docs/SSOT_PUBLIC_FIRST_2026_03.md` — 제품 방향·구현 truth·남은 과제의 최상위 기준
2. `AGENTS.md` — 에이전트 가드레일·보호 영역
3. `ARCHITECTURE.md` — 계층·소유권·anti-drift
4. `SYSTEM_FLOW.md` — end-to-end 흐름·continuity 계약
5. `DEVELOPMENT_RULES.md` — PR 규칙·상태 분리·모델 선택
6. `docs/REGRESSION_MATRIX.md` — 병합 전 시나리오 검증
7. `docs/KNOWN_RISKS_AND_OPEN_ITEMS.md` — 열린 리스크·출구 기준

코드·배포·DB의 **운영 SSOT**는 별도로 `origin/main` + Vercel 프로덕션 + Supabase 운영 DB이며, **제품/퍼널 의사결정**은 위 문서 스택이 우선한다.

---

## 0. 이 문서를 읽는 방법 — 세 층 분리 (필수)

| 구분 | 의미 | 이 문서에서의 위치 |
|------|------|---------------------|
| **CURRENT_IMPLEMENTED** | 이미 배포·코드에 반영된 동작, 또는 디버깅으로 확정된 사실 | §3, §3-7, §7 일부 |
| **LOCKED_DIRECTION** | 아직 전부 구현되지 않았을 수 있으나 **제품 방향으로 고정**된 원칙; 뒤집지 않음 | §4, §5, §6 P1/P2 |
| **NOT_YET_IMPLEMENTED** | 명시적으로 남은 구현·정합화 과제 | §6, §8, §9 |

**금지:** CURRENT_IMPLEMENTED와 LOCKED_DIRECTION을 한 문단에서 섞어 “이미 다 된 것처럼” 서술하지 않는다.

---

## 1. One-line summary

MOVE RE는 구조적으로 paid-first에서 public-first로 전환한 **골격 단계**에 있다.  
핵심 과제는 새 아키텍처를 무한히 추가하는 것이 아니라, **public 분석 → 결과 → 로그인/결제 → 온보딩 → claim → 세션 생성 → /app 실행**을 사용자 기준으로 끊김 없이 연결하고, **단일 입구 · 설문 baseline · 카메라 optional refine · 단순한 결과(행동 중심) · 실행 중심 전환**을 구현하는 것이다.

---

## 2. Product identity

MOVE RE는 운동 콘텐츠 앱이 아니다.  
MOVE RE는 정적 추천 라이브러리도 아니다.  
MOVE RE는 **상태 기반 운동 실행 시스템**이다.

핵심 루프:

`analysis → interpretation → readiness → session creation → execution → logging → adaptation → next session`

이번 전환에서 바뀐 것은 제품 본질이 아니라 **분석이 일어나는 위치**와 **결제의 의미**다.

### 과거 (deprecated 제품 흐름으로 문서에서만 구분)

`payment → in-app deep test → result → session create → execution`

위는 **과거 paid-first 서술**이다. 신규 기능 설계의 기본 전제로 되돌리지 않는다.

### 현재 / 목표 (canonical)

`public analysis → result → login/pay → onboarding/claim → session create → execution`

**결제는 분석을 여는 행위가 아니다. 결제는 실행을 여는 unlock이다.**

---

## 3. Current Implemented Truth (CURRENT_IMPLEMENTED)

### 3-1. Canonical flow (구현 기준 SSOT)

`public analysis → result → login/pay → onboarding-prep → onboarding → claim public result → session create → /app execution`

### 3-2. Canonical analysis truth

Deep Result V2가 단일 분석 truth다.

### 3-3. Camera role (구현)

Camera는 독립 결과 엔진이 아니다.  
Survey baseline 위에 올리는 **optional refine evidence** 채널이다.

### 3-4. Session creation source-of-truth

세션 생성의 1차 source-of-truth는 **claimed public result**다.  
legacy paid deep는 fallback only다.

### 3-5. Readiness role

Canonical readiness는 사용자가 지금 무엇을 해야 하는지 결정한다.

Allowed `next_action` 예시: `login`, `pay`, `claim_result`, `complete_onboarding`, `create_session`, `open_app`, `blocked`

### 3-6. Structural layers already completed (요약)

- V2-03 ~ V2-06: 설문→증거, baseline, 카메라 어댑터, 융합, 통합 public result
- FLOW-01 ~ FLOW-08: `public_results`, handoff, auth/pay bridge, 온보딩, claim, session create 재배선, readiness, `/app` 진입

### 3-7. Critical debugging truths (확정된 사실)

#### Empty plan — `scoring_version` 혼동

public result의 `_compat.scoring_version`(분석 엔진 식별자)이 세션 **템플릿 풀 조회 키**로 새어 들어가면, DB에 없는 버전 문자열로 조회 → 템플릿 0건 → `plan_json.meta`는 있으나 `segments=[]`.

**조치(구현됨):** `deep_v3`만 유지, 그 외 템플릿 풀 관점에서는 `deep_v2`로 정규화.

#### Empty draft 재사용

빈 draft(`segments` 없음)도 idempotent 경로에서 재사용되던 문제.

**조치(구현됨):** empty draft는 invalid로 보고 재생성 경로로 fall-through.

#### Auth intent handoff

login/signup/signup-complete 구간에서 `next` 단절 및 **루트 `/` 복귀**가 있던 문제.

**조치(구현됨):** AppAuthClient에서 로그인·회원가입 동일 `next`; `/signup?next=`; `signup/complete?next=`; 기본 복귀는 `/app/home`; 이메일 OTP `emailRedirectTo`에 `next` 유지; `router.replace('/')` 하드코딩 제거.

**의미:** “auth 성공 후 마케팅 루트 `/`로 의미 없이 튕김”을 제품 기본으로 두지 않는다. (의도적 ‘메인으로’ 링크는 별도 UX)

---

## 4. Locked Product Direction (LOCKED_DIRECTION — 전부 구현 완료는 아님)

아래는 제품 방향으로 **잠겼으며**, 구현 상태는 단계별로 다를 수 있다.

### 4-1. Single public entry

입구는 하나. 첫 CTA는 하나(예: “내 몸 상태 1분 체크하기”).  
설문과 카메라를 **동등한 두 개의 공개 진입**으로 두지 않는다.

### 4-2. Survey as baseline

설문이 baseline analysis를 만든다. (권장 pre-survey: 나이대, 성별, 운동 경험, 불편 부위 등 — 세부는 구현에서 조정)

### 4-3. Camera = optional refine before final result

- Survey만으로도 결과가 완성된다.
- Camera는 결과 직전에 선택 가능한 **보강 입력**이다.
- 진단·의학 톤 금지. “시작점을 조금 더 맞추는 확인” 수준의 카피 방향.

### 4-4. Simplified result — action-oriented

내부 score / raw axis / priority vector를 **주요 공개 UX의 중심**에 두지 않는다.  
사용자에게 필요한 것: 타입에 가까운 점, 이유, 조심할 움직임, 지금 무엇부터 할지.

### 4-5. Result structure — 2~3 screens (권장 IA)

화면 1: 현재 타입·짧은 설명·핵심 패턴  
화면 2: 왜 이런지·조심할 움직임  
화면 3: 추천·생활습관·execution CTA·운동 순서 preview

### 4-6. Conversion — execution order preview

마지막 화면은 “운동 나열”보다 **순서·흐름**이 드러나게. 잠금 표현보다 “결제 후 바로 열림·자동 구성” 톤 권장.

### 4-7. Payment unlocks execution, not analysis

분석은 public에서 끝난다. 결제는 그 분석을 바탕으로 **실행을 시작하는 권한**을 연다.

### 4-8. Auth/pay must preserve result continuity

실행 시작 시점의 pending public result, `next`, pay intent, **bridge context**(`moveReBridgeContext:v1` 등)가 유지되어야 한다.  
Auth 성공 후 **의도 없이 마케팅 루트 `/`로만 보내지 않는다** (복귀는 `next`·`/app/home` 등 계약된 경로).

### 4-9. Post-pay onboarding — minimal

짧게. pre-survey에서 이미 받은 항목(예: 나이·성별) 재질문 금지.

### 4-10. Session generation UX — short, believable staged

약 1.5~3초 수준, 실제 처리와 어느 정도 맞는 카피. 완전 가짜 진행률·과도한 고정 대기 금지.

### 4-11. PWA install — after session creation

세션 생성 직후가 핵심 타이밍. 링크 복사·브라우저 열기·홈 화면 추가를 짧게.

### 4-12. First app experience — execution-first, minimal tutorial

설명 과잉 금지. 세션 패널·재생·플레이어 흐름 정도의 최소 가이드.

---

## 5. Product laws (locked)

1. 분석은 public에서 끝낸다.  
2. 결제는 분석이 아니라 실행 권한을 연다.  
3. 카메라는 선택적 refine 입력이다.  
4. 결과는 설명보다 행동 유도 중심이다.  
5. 로그인·가입·완료 후 **의도 없이 루트 `/`로만 튕기지 않는다** (계약된 `next`/앱 홈).  
6. 첫 app 경험은 설명보다 실행 중심이다.  
7. 분석 엔진 식별자와 세션/템플릿 선택 키를 같은 의미로 쓰지 않는다.  
8. public result 호환 메타데이터를 세션 템플릿 truth로 직접 쓰지 않는다.  
9. 카메라를 별도 제품·별도 진입의 동등한 축으로 만들지 않는다.  
10. 문서에서 CURRENT_IMPLEMENTED와 LOCKED_DIRECTION을 섞지 않는다.

### 5-1. Session truth continuity law (locked)
11. public result truth는 result 페이지에서 끝나지 않고 session creation까지 연속되어야 한다.  
12. session create는 selected current analysis truth를 이어받아야 하며 generic routine fallback을 기본으로 삼지 않는다.  
13. session 1은 selected current state truth의 continuation처럼 체감되어야 한다.

### 5-2. Phase semantics preservation law (locked)
14. `Prep` semantics는 `Main` semantics를 silently dominate하면 안 된다.

### 5-3. PR3/PR4 boundary law (locked)
15. `selected_truth_trace`는 what truth won and why를 설명한다 (source/stage/timestamps/fallback layer).  
16. `alignment_audit`는 generated output이 selected truth를 honor했는지 판정한다.  
17. 두 contract를 conflation하거나 상호 대체하지 않는다.

---

## 6. Current highest-priority remaining work (NOT_YET_IMPLEMENTED / 정합화)

### P0

- single-entry public funnel 구조 정리  
- result 직전 camera optional bridge 도입  
- result IA 단순화  
- pending result / auth / pay continuity 완전 잠금  
- regression matrix 운영 고정  

### P1

- preview_ready 422 / state-machine semantics  
- bootstrap / public-result source alignment  
- post-pay onboarding 축소  
- session generation staged UX  
- PWA install 가이드  
- first app tutorial 최소화  

### P2

- conversion preview 고도화  
- reset map 설명  
- camera refine 카피·UI  
- 운영성 empty draft 정리 판단  

---

## 7. Current known truths by area (요약)

| 영역 | 요약 |
|------|------|
| Public analysis | 구조는 갖춤; 입구·결과 표현은 단순화 방향 |
| Auth / pay bridge | `next`·bridge 강화됨; checkout 즉시 연결 UX는 추가 polish 여지 |
| Onboarding / claim | 연결됨; 짧게 다듬기 단계 |
| Session creation | empty plan·empty draft 핵심 원인 처리됨 |
| Bootstrap / home | source alignment·preview semantics·첫 실행 polish 남음 |
| Error surfacing | 여전히 관측·메시지 분리 여지 |

---

## 8. Hard lessons (요약)

1. 분석 엔진 식별자 ≠ 템플릿 풀 키 — 혼동 시 대형 장애.  
2. 사용자에게는 내부 축보다 “왜 / 무엇을 조심 / 무엇부터”가 중요하다.  
3. 카메라는 선택 보강이지 독립 공개 진입이 아니다.  
4. 컨텍스트 단절은 구조가 맞아도 체감 실패로 이어진다.  
5. 결제 후 온보딩·생성·설치·첫 진입은 한꺼번에 길게 쓰면 안 된다.

---

## 9. Recommended PR order (참고)

1. single-entry funnel 잠금  
2. result 직전 optional camera bridge  
3. result IA 단순화 (2~3 화면)  
4. survey / camera / auth / pay / claim / create / app 회귀 봉인  
5. preview_ready 정합화  
6. bootstrap·public-result source alignment  
7. post-pay onboarding 최소화  
8. session generation staged UX  
9. PWA·첫 튜토리얼 polish  
10. 에러 표면화·관측성  

### 9-1. Canonical follow-up memory after PR52 (locked order)
1. source-selection truth  
2. first-session composition quality  
3. alignment audit / guardrails  
4. truth-owner / trace contract cleanup  
5. docs alignment

---

## 10. Model guidance (참고)

- **Sonnet 4.6급:** SSOT·상태머신·auth/pay/claim·readiness·bootstrap 소유권·멱등·복구  
- **Composer급:** 카피·좁은 UI·staged 로딩·온보딩 축소·설치 가이드·회귀 체크리스트 문서  

---

## 11. Final compressed conclusion

구조적 public-first 골격은 통과했다. 남은 일은 **단일 입구 · 설문 baseline · 결과 직전 optional 카메라 refine · 2~3 화면 결과 · continuity 유지한 auth/pay · 짧은 온보딩 · 믿을 수 있는 세션 생성 · 세션 후 설치 · 실행 우선 첫 경험**을 끊김 없이 구현하고 회귀를 봉인하는 것이다.
