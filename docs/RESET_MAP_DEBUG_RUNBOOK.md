# Reset Map Debug Runbook

**목적**: Reset-map 실행 진입(execution-entry) 실패·이상 동작을 진단하고 원인을 파악하기 위한 개발자용 가이드.

---

## 1. 개요

Reset-map은 세션 진입 전 플로우(start → preview → apply)를 관리한다. 이 문서는 다음을 다룬다:

- 플로우/이벤트 조회
- 메트릭 해석
- 흔한 실패 패턴과 진단 순서

---

## 2. API 엔드포인트

| 엔드포인트 | 용도 | 인증 |
|------------|------|------|
| `GET /api/reset-map/debug/recent` | 현재 사용자 최근 플로우 목록 | Bearer |
| `GET /api/reset-map/debug/[flowId]/events` | 특정 플로우의 이벤트 타임라인 | Bearer |
| `GET /api/reset-map/debug/metrics` | 현재 사용자 메트릭 (카운트, 퍼널, 타이밍) | Bearer |

**쿼리 파라미터**

- `recent`: `?limit=20` (기본 20, 최대 50), `?since=2025-01-01T00:00:00Z`
- `metrics`: `?since=2025-01-01T00:00:00Z` (해당 시점 이후만 집계)

---

## 3. 플로우 실패 진단

### 3.1 "플로우가 시작되지 않음"

1. `GET /api/reset-map/debug/recent`로 최근 플로우 확인
2. `state`가 `started` 또는 `preview_ready`인 플로우가 있는지 확인
3. 없으면: `POST /api/reset-map/start` 호출 실패 가능성
   - `Idempotency-Key` 헤더 누락 → 400
   - 인증 실패 → 401
4. `GET /api/reset-map/debug/[flowId]/events`로 해당 플로우의 `started` 이벤트 존재 여부 확인

### 3.2 "Apply가 안 됨 (PREVIEW_REQUIRED)"

1. 플로우 `state` 확인: `started`이면 apply 불가 (PR-RESET-08)
2. `events`에서 `preview_ready` 이벤트 존재 여부 확인
3. `preview_blocked`만 있고 `preview_ready`가 없으면 → preview gate 미통과
4. `preview_blocked`의 `attrs.reasons` 확인 (아래 4절)

### 3.3 "중복 start / replay 동작"

1. `events`에서 `active_flow_reused`, `duplicate_start_prevented` 확인
2. 이 이벤트가 있으면: 동일 사용자에 대해 기존 active 플로우 재사용 (정상)
3. `idempotent_replay_served`, `idempotent_conflict_recovered`: 동일 Idempotency-Key로 재요청 시 캐시 응답 반환 (정상)

---

## 4. Preview Blocked 원인 분석

`preview_blocked` 이벤트의 `attrs.reasons` 배열을 확인한다.

| reason | 의미 | 대응 |
|--------|------|------|
| `PERMISSION_REQUIRED` | 카메라/모션 권한 미부여 | 권한 요청 UX 확인 |
| `LOW_TRACKING_CONF` | tracking_conf < 0.35 | 품질 신호 개선 또는 임계값 검토 |
| `LOW_LANDMARK_COVERAGE` | landmark_coverage < 0.5 | 랜드마크 커버리지 개선 |

`GET /api/reset-map/debug/metrics`의 `blocked_reason_distribution`으로 전체 분포 확인 가능.

---

## 5. 메트릭 해석

`GET /api/reset-map/debug/metrics` 응답:

- **flow_counts**: 플로우 수 (starts, applied, aborted, active)
- **event_counts**: 이벤트별 발생 횟수
- **blocked_reason_distribution**: preview_blocked 원인별 건수
- **funnel**: started → preview_ready → applied 단계별 건수
- **timing_ms**: start → preview_ready, start → apply의 median/avg (ms)

퍼널이 좁아지는 구간을 확인해 병목을 파악한다.

---

## 6. DB 직접 조회 (Supabase SQL)

```sql
-- 최근 플로우 (user_id로 교체)
SELECT id, user_id, state, started_at, applied_at, created_at
FROM reset_map_flow
WHERE user_id = '<user_id>'
ORDER BY created_at DESC
LIMIT 20;

-- 특정 플로우 이벤트
SELECT name, ts, attrs
FROM reset_map_events
WHERE flow_id = '<flow_id>'
ORDER BY ts ASC;

-- preview_blocked 원인 분포
SELECT jsonb_array_elements_text(attrs->'reasons') AS reason, count(*)
FROM reset_map_events
WHERE name = 'preview_blocked'
GROUP BY 1;
```

---

## 7. 보안

- 모든 debug 엔드포인트는 Bearer 인증 필요
- `recent`, `events`, `metrics`는 **현재 사용자 본인 데이터만** 반환
- 다른 사용자의 flow_id로 events 요청 시 404 (ownership 검증)
