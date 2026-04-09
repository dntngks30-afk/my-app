# PR-RF-STRUCT-01 — readiness contract single-owner

## Scope
- readiness 계산 owner를 `SessionReadinessV1` 서버 contract 1곳으로 고정한다.
- `getCanonicalUserReadiness.ts`는 legacy shape adapter로만 남기고, 새로운 readiness truth를 다시 결정하지 않는 consumer-only 경계로 정리한다.
- `ReadinessEntryGate.tsx`는 서버가 준 `next_action.code`를 소비해 라우팅만 수행하는 client consumer로 정리한다.
- transport surface는 `/api/readiness` + `fetchReadinessClient`로 고정하되, 의미 재판정은 금지한다.

## Non-goals
- auth UX 개편
- payment flow 변경
- claim flow 변경
- onboarding 의미 변경
- `/app/home`, `/app/checkin`, `/app/profile`, `AppShell`, persistent tab shell 수정
- `SessionPanelV2`, `ExercisePlayerModal`, execution/auth/completion/adaptive core 수정
- readiness status / next_action / execution_block semantics 변경
- session create, bootstrap, claim, onboarding write 동작 변경

## Locked truth
- readiness canonical owner는 서버다. 현재 `get-session-readiness.ts`는 read-only context 로드 후 `buildSessionReadinessV1`에서 단일 `status`, `next_action`, `execution_block`을 결정한다.
- `/api/readiness`는 위 owner를 그대로 노출하는 transport여야 한다. route는 `getSessionReadiness` 결과를 감싸서 반환할 뿐, 별도 readiness 판단을 추가하지 않는다.
- `getCanonicalUserReadiness.ts`는 이미 legacy adapter로 정의되어 있으므로, owner가 아니라 compatibility adapter로만 취급한다.
- `ReadinessEntryGate.tsx`는 readiness 소비 및 라우팅만 담당해야 한다. 계산 owner가 아니며, fetch 실패 시 pass-through를 유지한다.
- `next_action` 의미는 바꾸지 않는다.
- behavior-preserving boundary cleanup only.

## Why now
- 현재 readiness truth는 실질적으로 3군데에서 다시 조합된다.
  1. `buildSessionReadinessV1`가 canonical next_action을 결정한다.
  2. `getCanonicalUserReadiness.ts`가 동일 context를 다시 받아 `deriveBlockingReason`과 `deriveNextActionLegacy`로 legacy next_action을 재결정한다.
  3. `ReadinessEntryGate.tsx`가 client에서 `GO_*` 코드를 다시 route rule로 해석한다.
- 부모 SSOT의 핵심 문제도 “동일한 사용자 진행 판정이 여러 모듈에 중복 소유”라고 잠겨 있다.
- readiness owner를 먼저 고정해야 이후 bootstrap/session source/funnel 정리가 consumer cleanup으로 내려간다.

## Files / modules in scope
- `src/lib/readiness/get-session-readiness.ts`
  - canonical owner
  - `loadReadinessContext`
  - `buildSessionReadinessV1`
  - `getSessionReadiness`
- `src/lib/readiness/getCanonicalUserReadiness.ts`
  - legacy adapter
  - legacy type surface
  - legacy next_action/blocking_reason projection
- `src/app/app/_components/ReadinessEntryGate.tsx`
  - client consumer
  - client-side redirect mapping
  - sessionStorage one-shot gate
- boundary verification only:
  - `src/app/api/readiness/route.ts`
  - `src/lib/readiness/fetchReadinessClient.ts`

## Out of scope
- `getCurrentUserId`
- Supabase auth/session acquisition 방식
- `AppAuthGate`의 plan/auth pass-through 정책
- `/onboarding`, `/movement-test/baseline`, `/app/home` 각 페이지 내부 로직
- session generator / bootstrap / claim / onboarding complete write path
- `types.ts` 대청소 전면 수행
- legacy export 제거
- route rename / API rename
- client caching 정책 변경

## Current truth distribution
- canonical server owner:
  - `get-session-readiness.ts`
- legacy server-side re-derivation:
  - `getCanonicalUserReadiness.ts`
- client-side routing consumer:
  - `ReadinessEntryGate.tsx`
- transport only:
  - `/api/readiness`
  - `fetchReadinessClient`

정리 기준:
- owner = readiness meaning을 최종 결정하는 곳
- adapter = owner truth를 다른 shape로 투영하는 곳
- consumer = owner truth를 읽고 이동만 수행하는 곳

이 PR에서 잠글 구조는 아래다.

### Owner
- `buildSessionReadinessV1`

### Adapter
- `getCanonicalUserReadiness.ts`
- legacy field / legacy code projection only
- 새로운 readiness decision 금지

### Consumer
- `ReadinessEntryGate.tsx`
- `next_action.code`를 route action으로 소비만
- readiness 재판정 금지

### Transport
- `/api/readiness`
- `fetchReadinessClient`
- serialization / fetch only

## PR boundary
- 1차 PR은 “owner 고정 + adapter/consumer 경계 잠금”까지만 한다.
- 한 PR 안에서 다음을 같이 묶지 않는다.
  - bootstrap endpoint 정리
  - session create source alignment
  - onboarding flow 개편
  - auth/pay page 이동 정책 개편
  - legacy readiness type/export 대정리
- 특히 `getCanonicalUserReadiness.ts` 제거와 타입 surface 축소는 이 PR에 묶지 않는다. 그건 follow-up에서 다룬다.
- `ReadinessEntryGate.tsx`에서 redirect 대상 page 자체를 손대지 않는다.
- `/api/readiness` response contract shape 변경 금지.
- `SessionReadinessV1` field meaning 변경 금지.

## Intended end state after this PR
- 서버 canonical contract는 `SessionReadinessV1` 하나로 읽힌다.
- legacy shape가 필요하면 adapter가 canonical context를 읽어 projection만 한다.
- client gate는 canonical `next_action.code`를 소비만 한다.
- readiness truth를 새로 계산하는 실행 지점 수를 더 늘리지 않는다.

## Regression checklist
- unauthenticated 사용자:
  - `/api/readiness`가 `UNAUTHENTICATED_SESSION_READINESS_V1`를 그대로 반환하는지
  - client gate가 `GO_AUTH`만 소비하는지
- inactive plan:
  - canonical owner가 `GO_PAYMENT`를 유지하는지
  - client gate가 payment semantics를 다시 만들지 않는지
- no analysis input:
  - canonical owner가 `GO_RESULT`를 유지하는지
  - legacy adapter가 동일 상황을 별도 기준으로 뒤집지 않는지
- onboarding incomplete:
  - canonical owner가 `GO_ONBOARDING`를 유지하는지
  - client gate가 `/onboarding` redirect만 수행하는지
- active session exists:
  - canonical owner가 `GO_APP_HOME`를 유지하는지
- creatable session:
  - canonical owner가 `GO_SESSION_CREATE`를 유지하는지
  - client gate가 session create를 대신 실행하지 않는지
- fetch failure / null:
  - 기존 pass-through 유지
- route layer:
  - `/api/readiness`가 owner logic 외 별도 분기 추가 없이 동작하는지
- adapter layer:
  - `getCanonicalUserReadiness.ts`가 write/claim/create side effect 없이 read-only인지 유지되는지

## Risks
- 가장 큰 리스크는 `getCanonicalUserReadiness.ts`를 adapter라고 부르면서도 내부에서 `deriveNextActionLegacy`와 `deriveBlockingReason`로 다시 readiness 의미를 생산하고 있다는 점이다.
- `ReadinessEntryGate.tsx`는 현재 client route mapping을 들고 있으므로, 이후 page 경로 변경 시 readiness semantics 변경과 혼동될 수 있다.
- `sessionStorage` one-shot gate는 consumer 최적화일 뿐 owner가 아니다. 이를 readiness source처럼 취급하면 안 된다.
- transport(`/api/readiness`, `fetchReadinessClient`)와 owner가 섞이면 이후 bootstrap/readiness/session-preparing 경계가 다시 흐려진다.

## What must NOT be bundled in this PR
- `AppAuthGate` auth/pay logic 재설계
- `/app/home` 진입 UX 변경
- onboarding form semantics 수정
- session create trigger 변경
- claimed public result selection 규칙 변경
- legacy paid deep fallback 의미 변경
- readiness type/export 삭제 작업 전면 수행
- bootstrap source alignment
- `/api/session/create` 정리

## Follow-up PRs
1. PR-RF-STRUCT-02 — session source alignment
   - readiness owner를 고정한 뒤 create/bootstrap/read가 같은 analysis input truth를 읽게 정렬

2. PR-RF-STRUCT-04 — bootstrap endpoint boundary cleanup
   - readiness와 bootstrap의 역할 중복 제거

3. PR-RF-STRUCT-10 — readiness legacy type/export surface cleanup
   - 이번 PR에서 adapter로만 잠근 `getCanonicalUserReadiness.ts`와 legacy type surface를 축소/격리
   - 제거/축소는 반드시 이번 PR 이후

## One-line boundary rule
- readiness meaning은 서버 owner가 결정한다.
- legacy readiness는 projection만 한다.
- client gate는 소비만 한다.
- transport는 운반만 한다.