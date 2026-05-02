# PR-5: Analytics Retention Cohort Hardening

**Status:** CURRENT_IMPLEMENTED  
**Type:** Admin KPI hardening — no migration, no product behavior change  
**Scope:** `src/lib/analytics/`, `src/app/api/admin/kpi/`, `src/app/admin/kpi/`, `scripts/`

---

## 1. 목적

파일럿 운영 중 /admin/kpi 대시보드의 리텐션 해석 신뢰도를 높인다.  
데이터 증가에 따른 쿼리 안전성을 강화하고, 미성숙 코호트가 0%로 오해되는 문제를 해소한다.

PR-5는 새로운 추적 이벤트, 제품 동작, DB 마이그레이션을 포함하지 않는다.

---

## 2. 마이그레이션 결정

**마이그레이션 없음.**

- 기존 `analytics_events` 인덱스 (`event_name + created_at`, `kst_day + event_name`)는 파일럿 규모 집계에 충분하다.
- 일별 롤업 테이블은 실제 대시보드 타임아웃이 발생하는 시점에 별도 PR에서 도입한다.
- PR-5에서는 범위 클램프·적격 코호트 필터링·메타데이터로 해석 신뢰도를 먼저 확보한다.

---

## 3. 변경 파일 요약

| 파일 | 변경 종류 |
|------|-----------|
| `src/lib/analytics/admin-person-key.ts` | **신규** — KPI 읽기 전용 canonical person_key 헬퍼 |
| `src/lib/analytics/admin-kpi-types.ts` | **수정** — `eligible_*`, `generated_at`, `source`, `range_clamped`, `limitations`, `metric_note` |
| `src/lib/analytics/admin-kpi.ts` | **수정** — 임포트, `resolveKpiRange`, 리텐션 로직, 요약 공식, 메타 빌더 |
| `src/lib/analytics/identity.ts` | **수정** — write-path 헬퍼 구분 주석 추가 (동작 변경 없음) |
| `src/app/admin/kpi/KpiDashboardClient.tsx` | **수정** — 리텐션 성숙도 UI, 요약 카드 레이블, 메타 섹션 |
| `scripts/analytics-retention-hardening-smoke.mjs` | **신규** — PR-5 스모크 |
| `package.json` | **수정** — `test:analytics-retention-hardening` 스크립트 |
| `docs/pr/PR-ANALYTICS-RETENTION-HARDENING-05.md` | **신규** — 본 문서 |

**수정 불가 영역 (변경 없음):** 카메라 평가기, 결제, 클레임, 세션 생성, readiness, PWA/푸시 동작, 제품 라우트.

---

## 4. Canonical person_key 전략

### 기존 문제

- `admin-kpi.ts` 내부의 private `buildPersonKey` 함수가 외부에 노출되지 않았고,
- 수집 경로의 `identity.ts#getAnalyticsPersonKey`는 `user:` / `anon:` 접두사와 링크 해석이 없는 raw 헬퍼였다.
- 두 헬퍼가 혼동될 위험이 있었다.

### PR-5 해결

새 파일 `src/lib/analytics/admin-person-key.ts`에 `resolveAnalyticsPersonKeyForKpi`를 정의했다.

우선순위:
1. `user_id` 존재 → `"user:{user_id}"`
2. `anon_id`가 `analytics_identity_links`로 `user_id`에 연결됨 → `"user:{linked_user_id}"`
3. `anon_id` 존재 → `"anon:{anon_id}"`
4. fallback → `"event:{id}"`

`admin-kpi.ts`의 `fetchAnalyticsEvents` 내부에서만 이 함수를 사용한다.  
`identity.ts#getAnalyticsPersonKey`에 write-path 전용 주석을 추가했다.

---

## 5. 리텐션 코호트 정의 (확정)

### app_home 코호트

- 코호트 이벤트: 인당 첫 `app_home_viewed`
- cohort_day = `kst_day`

### first_session_complete 코호트

- 코호트 이벤트: `session_complete_success` 중 **`session_number === 1`만 엄격 포함**
- `session_number === null`은 세션 1로 취급하지 않음 — 미확인 세션으로 제외

### 복귀 이벤트 집합 (변경 없음)

- `app_home_viewed`
- `session_panel_opened`
- `exercise_player_opened`
- `session_complete_success`

### D1 / D3 / D7

- D1 = `cohort_day + 1`에 복귀 이벤트 발생
- D3 = `cohort_day + 3`에 복귀 이벤트 발생
- D7 = `cohort_day + 7`에 복귀 이벤트 발생
- 당일(cohort_day) 활동은 D1이 아님 (D1은 +1일 기준이므로 자동 제외)
- 코호트 자격 이벤트 자체는 복귀 신호로 계산하지 않음

---

## 6. D1/D3/D7 적격성 규칙

각 코호트 행(cohort_day)에 대해:

```
eligible_d1 = (cohort_day + 1) <= today_kst
eligible_d3 = (cohort_day + 3) <= today_kst
eligible_d7 = (cohort_day + 7) <= today_kst
```

적격하지 않으면:
- `d*_rate` = **null** (0%가 아님)
- `d*_returned` 카운트는 유지되나 비율 표시는 **대기**로 노출

---

## 7. 요약 카드 가중 리텐션 공식

기존: 최신 코호트 단일 행의 비율 사용 → 파일럿 초기 표본 1건이 요약을 왜곡할 위험

PR-5 공식:

```
D1_rate = sum(d1_returned, eligible_d1 행) / sum(cohort_size, eligible_d1 행)
D3_rate = sum(d3_returned, eligible_d3 행) / sum(cohort_size, eligible_d3 행)
D7_rate = sum(d7_returned, eligible_d7 행) / sum(cohort_size, eligible_d7 행)
```

분모 = 0이면 → `null` → 대시보드에서 **집계 대기** 표시

---

## 8. 날짜 범위 가드 동작

- 기본: 7일 (변경 없음)
- 최대: 90일 (변경 없음)
- **수정:** `resolveKpiRange`에서 `toExclusiveIso`가 항상 `kstDayToUtcIso(cappedToDay, true)` 기반으로 일관성 유지
- **수정:** 비 date-only `to` 입력 시에도 클램프 후 표시 범위와 내부 쿼리 상한이 동일한 일자를 기준으로 함
- **신규:** `range_clamped: boolean` 필드 — 응답 및 대시보드 경고 표시

---

## 9. API 메타데이터 변경

모든 `/api/admin/kpi/*` 성공 응답에 추가:

```json
{
  "ok": true,
  "range": { "from": "...", "to": "...", "tz": "Asia/Seoul", "range_clamped": false },
  "generated_at": "2026-05-02T06:12:00.000Z",
  "source": "raw_events",
  "limitations": ["retention_rates_use_weighted_eligible_cohorts", "..."],
  "...existing fields..."
}
```

`source`는 PR-5에서 항상 `"raw_events"`. 일별 롤업 도입 시 `"daily_rollup"` 또는 `"mixed"`로 확장 예정.

---

## 10. 대시보드 UI 변경

- **InsightCard** — optional `subtitle` prop 추가
- **D1/D3/D7 요약 카드** — 값이 null이면 "집계 대기", subtitle에 "적격 코호트 가중 평균"
- **리텐션 테이블** — `eligible_*` false인 셀은 "대기" 표시, 헤더에 기준 설명
- **세션 디테일** — `metric_note` 노출 (exercise_index 테이블이 이벤트 건수 기준임을 명시)
- **메타 섹션** — 대시보드 하단에 `generated_at`, `source`, `range`, `limitations` 표시
- **range_clamped 경고** — 클램프 발생 시 amber 경고 배너

---

## 11. 스모크 / 테스트 결과

`npm run test:analytics-retention-hardening`

확인 항목 (16개):
1. `admin-person-key.ts` 존재 및 `resolveAnalyticsPersonKeyForKpi` export
2. `admin-kpi.ts` 가 canonical 헬퍼를 import·사용
3. 기존 `buildPersonKey` private 함수 제거됨
4. 타입 및 로직에 `eligible_d1/d3/d7` 존재
5. 미적격 시 `percentage()` 대신 `null` 반환
6. `session_number === 1 || session_number == null` 패턴 제거됨
7. `appHomeRetention.at(-1)` 패턴 제거됨 → `computeWeightedRetentionRates` 사용
8. `generated_at`, `source`, `range_clamped` 타입 및 로직 존재
9. `toExclusiveIso`가 `cappedToDay` 기반으로 항상 일관
10. 새 마이그레이션 없음
11. 제품 라우트 수정 없음
12. 카메라 평가기 수정 없음
13. 결제/클레임/세션생성/readiness 수정 없음
14. PR-1/2/3/4 스모크 파일 유지
15. admin KPI 라우트가 여전히 `requireAdmin` + `no-store` 사용
16. `admin-kpi.ts` 가 analytics_events 에 write 하지 않음

기존 스모크 4종(`test:analytics-event-infra`, `test:analytics-core-funnel-tracking`, `test:analytics-admin-kpi-dashboard`, `test:analytics-detailed-tracking`) 회귀 없음.

---

## 12. 알려진 제한 사항 (Known Limitations)

- **raw_events 기반 집계** — 파일럿 규모에서 허용됨. 데이터 증가 시 별도 rollup PR 예정.
- **exercise_index by 이벤트 건수** — person-distinct 아님. 대시보드에서 명시.
- **raw events 페이지네이션** — `created_at` cursor 기반, limit 최대 200 유지.
- **first_session_complete session_number null** — 코호트에서 제외됨. 집계 초기 파일럿에서 일부 이벤트가 누락될 수 있음.
- **D1/D3/D7 당일 경계** — cohort_day 당일의 복귀 이벤트는 Dk 계산에 포함되지 않음 (D1 = cohort_day+1 기준).

---

## 13. 파일럿 분석 준비 상태

**CURRENT_IMPLEMENTED (PR-5 후):**
- 어드민 KPI 대시보드 — 퍼널·리텐션·디테일·raw events 읽기 경로
- 리텐션 적격성 분리 — 미성숙 코호트 0% 왜곡 제거
- 가중 요약 리텐션 — 단일 최신 행 의존 제거
- first_session_complete 코호트 엄격 분리 (session_number === 1만)
- 날짜 범위 클램프 일관성
- 전 KPI API 응답 메타데이터
- canonical person_key 모듈화

**LOCKED_DIRECTION:**
- 일별 롤업 테이블: 파일럿 후 별도 PR
- `source: 'daily_rollup'` 경로: 롤업 PR에서 활성화

**파일럿 운영 준비 완료.** 기존 PR-1~4 추적 파이프라인은 변경 없음.
