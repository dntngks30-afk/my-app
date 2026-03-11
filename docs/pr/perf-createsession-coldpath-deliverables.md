# PR: perf - createSession cold path 계측 및 최소 개선

## 1. Root-cause 요약

- **문제**: current session에서 `activePlan === null`일 때 패널 오픈이 `createSession(summary:true)` 완료에 묶여 있어 첫 클릭 체감이 느림.
- **원인**: createSession 내부 단계(auth → dedupe → progress → deep load → adaptive load → adaptive modifier → generation → plan write → serialization)가 모두 직렬로 실행되며, 단계별 시간 가시성이 부족함.
- **이번 PR**: 계측 강화 + debug 플래그 전달 + 클라이언트 performance marks 추가. summary-first 구조 변경은 범위 밖.

## 2. Slow-path 단계별 타이밍 (계측 항목)

| 단계 | 필드명 | 설명 |
|------|--------|------|
| auth | `auth_ms` | getCurrentUserId |
| dedupe | `dedupe_ms` | tryAcquireDedupe |
| progress read | `progress_read_ms` | session_program_progress 조회 |
| progress db | `progress_db_ms` | progress 초기화/업데이트 |
| deep load | `deep_profile_ms`, `deep_load_ms` | loadSessionDeepSummary |
| adaptive load | `adaptive_load_ms` | loadRecentAdaptiveSignals |
| adaptive modifier | `adaptive_modifier_ms` | loadLatestAdaptiveSummary + resolveAdaptiveModifier |
| generation | `generation_ms` | buildSessionPlanJson (캐시 미스 시) |
| serialization | `serialization_ms` | JSON.stringify(planJson) |
| plan write | `plan_write_ms` | session_plans UPSERT |
| total | `total_ms` | 전체 경로 |

**측정 방법**: `/app/home?debug=1` 접속 후 current session 첫 클릭 → 서버 콘솔에 `[session/create] perf` 로그 출력. 응답 body에 `debug` 블록으로 timings 포함.

## 3. 변경된 파일

| 파일 | 변경 내용 |
|------|-----------|
| `src/app/api/session/create/route.ts` | `adaptive_modifier_ms`, `deep_load_ms` 추가 |
| `src/app/app/(tabs)/home/_components/HomePageClient.tsx` | ResetMapV2에 `debug={debugFlag}` 전달 |
| `src/app/app/(tabs)/home/_components/reset-map-v2/ResetMapV2.tsx` | `debug` prop, createSession에 debug 전달, performance.mark('createSession-start/end') |
| `src/app/app/(tabs)/home/_components/reset-map-v2/SessionPanelV2.tsx` | performance.mark('panel_exercises_ready') |

## 4. Blocking work 제거/연기/불가 검증

- **제거**: 없음 (이번 PR은 계측만)
- **연기**: summary-first 구조 변경 (API contract 변경 필요) → 다음 PR 후보
- **불가**: plan은 generation + DB write 이후에만 존재. 응답을 더 일찍 보내려면 API 계약 대폭 변경 필요.

## 5. Summary-first current-null 렌더링 가능 여부

**현재 구조로는 불가.** create route는 이미 `toSummaryPlan(plan)`으로 경량 응답을 반환하지만, plan 자체가 generation과 plan_write 이후에만 생성됨. summary를 더 빨리 반환하려면:
- generation/write를 분리하고 "summary-only" 경로를 새로 설계하거나
- streaming/partial response 등 API 계약 변경이 필요함.
→ 이번 PR에서는 계측 강화에 집중.

## 6. Before/after 타이밍

- **Before**: 단계별 타이밍이 `adaptive_modifier` 구간 누락, `deep_load_ms` 별칭 없음.
- **After**: `adaptive_modifier_ms`, `deep_load_ms` 추가. `?debug=1` 시 서버 로그 + 응답에 전체 timings 포함.
- **클라이언트**: `createSession-start` ~ `createSession-end`, `panel_opened` ~ `panel_exercises_ready` performance marks로 구간 측정 가능.

## 7. 리스크, 롤백, 다음 단계

- **리스크**: 낮음. 계측/플래그만 추가, 기존 로직 변경 없음.
- **롤백**: 해당 커밋 revert.
- **다음 단계**: 
  1. `?debug=1`로 cold path 측정 후 병목 단계 식별
  2. 병목이 generation/plan_write라면 summary-first 분리 검토 (별 PR)
  3. 병목이 deep_load/adaptive라면 해당 레이어 최적화 검토
