# PR-FLOW-06 — Canonical Session Readiness Layer

## 목적

공개 결과 이후 실행 진입 상태를 **SessionReadinessV1** 단일 계약으로 정규화한다. 스코어링·PublicResultRenderer·세션 컴포저·실행 코어는 변경하지 않는다.

## SSOT

- **서버 계산:** `src/lib/readiness/get-session-readiness.ts` — `loadReadinessContext` + `buildSessionReadinessV1` + `getSessionReadiness`
- **API:** `GET /api/readiness` → `SessionReadinessV1` (미인증 시 `UNAUTHENTICATED_SESSION_READINESS_V1`)
- **클라이언트:** `fetchReadinessClient` → `SessionReadinessV1`; `ReadinessEntryGate`는 `GO_*` next_action 처리

## 판정 순서 (단일 next_action)

1. `needs_auth` / `GO_AUTH` — 미인증  
2. `needs_payment` / `GO_PAYMENT` — `plan_status !== 'active'`  
3. `needs_result_claim` / `GO_RESULT` — claimed public **및** legacy deep 요약 모두 없음 (`hasAnalysisInput === false`)  
4. `needs_onboarding` / `GO_ONBOARDING` — 주간 빈도·운동 경험·통증 확인 최소 미충족  
5. `session_already_created` / `GO_APP_HOME` — `active_session_number` 존재  
6. `execution_blocked` / `GO_APP_HOME` — 프로그램 완료 또는 일일 제한 (`execution_block` 참조)  
7. `ready_for_session_create` / `GO_SESSION_CREATE` — 위를 통과하고 세션 생성 가능  

## 결과 요약 (result_summary)

- **클레인된 공개 결과가 있을 때만** 채움 (`getLatestClaimedPublicResultForUser`).
- `source_mode`는 `UnifiedDeepResultV2.source_mode`가 아니라 **DB `result_stage`** (`baseline` | `refined`).
- `priority_vector`는 객체의 **축 키 정렬 배열** (값 재해석 없음).

## 레거시

- `getCanonicalUserReadiness` / `CanonicalUserReadiness`는 동일 `loadReadinessContext`에서 매핑해 유지 (서버 내부·테스트 호환).

## READ ONLY

readiness 조회 경로에서 claim·세션 생성·온보딩 저장·bridge 변조 없음.
