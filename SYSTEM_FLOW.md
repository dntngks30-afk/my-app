역할: 사용자 흐름, 상태 전환, 브리지 continuity를 정의하는 문서. 라우트보다 상위의 end-to-end flow와 상태 semantics를 정리한다.

# SYSTEM_FLOW.md

## Documentation precedence

문서 스택 4순위. 충돌 시 더 상위 문서가 우선한다.

1. `docs/SSOT_PUBLIC_FIRST_2026_03.md`
2. `AGENTS.md`
3. `ARCHITECTURE.md`
4. **SYSTEM_FLOW.md** (본 문서)
5. `DEVELOPMENT_RULES.md`
6. `docs/REGRESSION_MATRIX.md`
7. `docs/KNOWN_RISKS_AND_OPEN_ITEMS.md`

흐름 설명 시 **CURRENT_IMPLEMENTED**와 **LOCKED_DIRECTION**을 한 단계로 합쳐 “이미 전부 구현됨”처럼 쓰지 않는다.

---

## 0. 문서 목적
이 문서는 MOVE RE의 end-to-end 사용자 흐름을 정의한다.  
세부 구현 경로보다, 사용자가 실제로 어떤 순서로 어떤 상태를 거치며 무엇이 유지되어야 하는지를 설명한다.

---

## 1. Top-level flow

권장 최종 흐름:

A. Public entry  
-> B. Pre-survey  
-> C. Free survey baseline  
-> D. Optional camera refine bridge  
-> E. Simplified result 2~3 screens  
-> F. Conversion preview  
-> G. Auth/pay bridge  
-> H. Post-pay onboarding  
-> I. Session generation staged screen  
-> J. PWA install guide  
-> K. App first entry tutorial  
-> L. App execution

---

## 2. Detailed flow by phase

### A. Public entry
목표:
- 입구를 하나로 줄인다
- 사용자가 처음부터 “설문 vs 카메라”를 고르지 않게 한다

Locked direction:
- 메인 CTA는 1개
- 예: 내 몸 상태 1분 체크하기

Continuity requirements:
- 여기서부터 public result 흐름이 시작되며, 나중에 auth/pay 이후에도 이 흐름의 의미가 유지되어야 한다

---

### B. Pre-survey
목표:
- baseline 해석에 필요한 최소 컨텍스트를 수집
- 긴 입력 피로 없이 personal relevance를 만든다

권장 항목:
- 나이대
- 성별
- 운동 경험
- 현재 가장 불편한 부위 / 없음

Rules:
- 이후 onboarding에서 중복 질문하지 않는다
- 여기서 받은 값은 baseline context의 일부가 된다

---

### C. Free survey baseline
목표:
- baseline analysis 생성
- camera 없이도 결과가 완성되게 한다

Rules:
- survey만으로 result 생성 가능해야 한다
- camera는 필수가 아니다
- result persistence의 기준이 되는 첫 public result candidate를 만든다

Persistence:
- 결과는 auth 없이도 저장 가능해야 한다
- 나중에 claim 가능한 형태로 유지되어야 한다

---

### D. Optional camera refine bridge
목표:
- 결과 직전에 camera를 optional refine evidence로 제안
- separate product 느낌 없이 자연스럽게 보강 옵션으로 제시

Allowed user choices:
1. 지금 카메라로 움직임 체크하기
2. 결과 먼저 보기

Rules:
- camera를 안 해도 결과는 열려야 한다
- camera를 하면 baseline을 refine하는 구조여야 한다
- camera는 정확도/AI 진단 강조보다 “시작점을 조금 더 맞추는 보강”처럼 보여야 한다

Continuity:
- camera 이후에도 결과는 같은 public-result continuity 위에서 이어져야 한다
- baseline result와 refined result 관계가 끊기면 안 된다

---

### E. Simplified result 2~3 screens
목표:
- 사용자가 내부 분석 축이 아니라 “행동”을 이해하게 한다

권장 구조:

#### Result 1
- 현재 타입
- 짧은 한 줄 설명
- 핵심 패턴 2~3개

#### Result 2
- 왜 이런지
- 조심할 움직임 3~4개

#### Result 3
- 추천 운동 1~2개
- 생활습관 2~3개
- execution CTA
- 운동 순서 preview

Rules:
- confidence / raw score / priority vector / pain_mode / 내부 axis를 전면 노출하지 않는다
- 설명보다 다음 행동을 더 강조한다

---

### F. Conversion preview
목표:
- “분석 결과”를 “실행 가치”로 바꾼다

권장 노출:
- 폼롤러/이완 1개
- 스트레칭 1개
- 이후 활성화/통합 운동은 preview 수준

Copy direction:
- 잠김보다 “결제 후 바로 열림”, “개인 상태 반영 후 자동 구성”, “운동 순서까지 완성”이 적합

Rules:
- 결과가 끝나고 결제가 갑자기 등장하는 느낌을 줄이지 않도록
  result 마지막 화면과 conversion block 사이 의미 연결이 필요하다

---

### G. Auth / pay bridge
목표:
- 사용자가 방금 본 결과와 intent를 잃지 않게 한다
- auth 이후 **마케팅 루트(`/`)로 의도 없이만** 튕기지 않게 한다 (`next`/bridge·checkout·앱 홈 등 계약된 복귀)

Must preserve:
- pending public result
- execute intent
- next path
- pay context
- bridge context

Rules:
- login / signup / signup-complete 전 구간에서 next를 유지
- auth 후에는 result/pay bridge로 자연 복귀하거나 checkout으로 연결
- “처음부터 다시 하세요”처럼 느껴지면 안 된다

Current implemented truth:
- next continuity hardening은 들어가 있다
- 최종 UX 완성은 아직 후속 polish 대상일 수 있다

---

### H. Post-pay onboarding
목표:
- execution readiness 입력을 짧게 받는다
- claim + session create 입력을 보강한다

권장 항목:
- 주당 운동 가능 횟수
- 최근 3개월 운동 경험
- 불편 부위 / 통증 여부
- 질환/수술/제한 여부

Rules:
- pre-survey와 중복 금지
- 3~4 step 수준 유지
- 결제 직후 피로도가 높으므로 길게 만들지 않는다

Continuity:
- claim 전 /app/home 직접 진입 금지
- onboarding 종료 후 claim / session create로 이어진다

---

### I. Session generation staged screen
목표:
- 세션 생성이 실제로 일어나고 있다는 느낌 제공
- 너무 빠른 “허무한 성공”과 너무 긴 fake loading을 모두 피한다

권장 문구 방향:
1. 상태를 반영해 운동 시작점을 정리하고 있어요
2. 조심해야 할 움직임과 난이도를 맞추고 있어요
3. 리셋맵의 전체 세션을 구성하고 있어요

Rules:
- 실제 처리 단계와 어느 정도 대응해야 한다
- 길어도 과도하게 길지 않게
- 1.5~3초 수준이 기본
- 실제 생성이 더 길면 실제 시간만큼 기다린다

---

### J. PWA install guide
목표:
- 사용 의지가 가장 높은 시점에 install CTA 제시
- 인앱 브라우저 이슈를 회피하게 돕는다

권장 요소:
- 홈 화면에 추가 안내
- 링크 복사
- 크롬에서 열기
- 사파리에서 열기

Rules:
- 길게 설명하지 않는다
- install이 execution을 방해하지 않게 한다
- skip 가능해야 한다

---

### K. App first entry tutorial
목표:
- /app/home 첫 진입에서 가장 필요한 행동만 이해시킨다

권장 튜토리얼 포인트:
1. 세션 패널
2. 재생 버튼
3. 플레이어 흐름

Rules:
- 길지 않게
- 설명보다 실행 유도
- 사용자가 바로 첫 루틴을 시작할 수 있게

---

### L. App execution
목표:
- 세션 패널 -> 플레이어 -> 기록 -> 완료 -> 다음 세션 흐름
- MOVE RE의 핵심 execution loop 제공

Boundary:
- public-entry 혹은 auth/pay continuity 작업이 execution core를 불필요하게 흔들지 않게 한다

---

## 3. Critical continuity contracts

### Contract 1. Public result continuity
public result는 auth 이전에도 존재하고, auth 이후에도 같은 결과 continuity 위에서 이어져야 한다.
또한 continuity는 result 화면에서 끝나지 않고 session creation 입력 truth까지 이어져야 한다.
session create는 selected current public result truth의 continuation이어야 하며 generic routine 생성으로 퇴행하면 안 된다.

### Contract 2. Auth continuity
login/signup/signup-complete 이후 **마케팅 루트(`/`)로 의도 없이만** 튕기면 안 된다. 복귀는 `next`·bridge·`/app/home` 등 **의도가 보존된 경로**여야 한다.

### Contract 3. Claim continuity
claim 완료 전 app entry가 먼저 열리면 안 된다.

### Contract 4. Session create validity
empty draft를 valid plan처럼 재사용하면 안 된다.

### Contract 5. Result semantics
survey는 baseline, camera는 refine다.  
둘을 parallel independent product처럼 다루지 않는다.

### Contract 6. Result presentation
복잡한 내부 분석 정보보다, 사용자 행동 가이드를 우선한다.

### Contract 7. Session 1 alignment law
session 1은 selected current state truth의 continuation처럼 체감되어야 한다.
state-based execution의 증거는 설명 문구가 아니라 실제 session 구성에서 느껴져야 한다.

### Contract 8. Phase semantics preservation
`Prep` semantics는 `Main` semantics를 silently dominate하면 안 된다.

### Contract 9. Trace-vs-audit boundary
- `selected_truth_trace`: what truth won and why (stage/timestamps/fallback layer 포함)
- `alignment_audit`: generated output이 그 truth를 실제로 honor했는지
- 두 블록을 혼합 해석하지 않는다.

### Contract 10. Canonical follow-up memory (post-PR52)
1) source-selection truth  
2) first-session composition quality  
3) alignment audit/guardrails  
4) truth-owner/trace contract cleanup  
5) docs alignment

---

## 4. Current known state-machine semantics

### preview_ready
preview_ready는 started와 같은 의미가 아니다.  
preview submit 대상은 started 상태여야 한다.

### claim race
claim이 끝나기 전에 home entry가 열리면 안 된다.

### invalid draft
draft plan에서 segments가 없거나 비어 있으면 재사용하면 안 된다.

### auth next
auth 경로 전 구간에서 next는 끊기면 안 된다.

---

## 5. Current most failure-prone areas
- single-entry 도입 중 과거 2-entry 흔적과 충돌
- result-before-camera bridge의 흐름 중단
- auth -> pay continuity 미세 끊김
- preview_ready state 재소비
- bootstrap/public-result source misalignment
- generation/loading이 가짜처럼 느껴질 위험
- app first tutorial이 길어질 위험
