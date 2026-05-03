# PR-KPI-PUBLIC-TEST-RUNS-03D Plan

## 1. Summary

Admin KPI의 `pilot_code` 필터가 **`public_test_runs`를 1순위 attribution 소스**로 사용하도록 확장한다. PR03B/C로 run 행에 `public_result_id`·`user_id`·`claimed_at`이 채워지므로, 동일 anon/browser의 **연속 테스트(run 경계)**와 **post-auth 이벤트(props에 pilot 부재)**를 PR02의 latest-profile 단일 행보다 안정적으로 설명할 수 있다.

핵심 결정:

- 행 단위 매칭은 **`public_result_id` → `user_id`+`claimed_at` → anon `started_at`~다음 run 시작** 순으로 강도를 두되, **동일 anon의 다음 run 시작(어떤 pilot이든)** 을 anon-window 상한으로 써서 서로 다른 pilot run이 섞이지 않게 한다.
- [`filterRowsByPilotCode`](src/lib/analytics/admin-kpi-pilot-filter.ts)에 run 배치 로드 + 매칭을 넣고, 매칭 실패 시 **기존 PR02 순서(direct props → public_test_profiles → signup_profiles)** 로 폴백한다.
- Raw-events의 **페이지 내 필터로 인한 행 부족**은 파일럿 전에는 **한계 문구 유지 + 선택적 PR03D2 개선**으로 분리한다.

---

## 2. CURRENT_IMPLEMENTED

| 영역 | 상태 |
|------|------|
| PR02 pilot 필터 | [`filterRowsByPilotCode`](src/lib/analytics/admin-kpi-pilot-filter.ts): `props.pilot_code` → `public_test_profiles`(anon/user/public_result) → `signup_profiles`(user). [`KpiPilotFilterableEventRow`](src/lib/analytics/admin-kpi-pilot-filter.ts)에는 `created_at` 없음. |
| KPI 행 데이터 | [`AnalyticsEventRow`](src/lib/analytics/admin-kpi.ts)는 `created_at` 포함. `filterRowsByPilotCode` 입력은 `EventWithPersonKey` 등으로 실제 런타임에는 `created_at` 존재. |
| Demographics | [`computeKpiDemographicsSummary`](src/lib/analytics/admin-kpi-demographics.ts)는 **필터링된 rows** 기준으로 프로필 조회; pilot 필터와 동일 subset을 쓰는 것이 일관됨. |
| Raw events | [`getKpiRawEvents`](src/lib/analytics/admin-kpi.ts): DB에서 `limit` 페이지 조회 후 [`filterRowsByPilotCode`](src/lib/analytics/admin-kpi-pilot-filter.ts) 적용 → [`limitations`](src/lib/analytics/admin-kpi.ts) `raw_events_time_window_unchanged_pilot_may_reduce_visible_rows`. |
| `public_test_runs` | 마이그레이션 [`20260504120000_public_test_runs.sql`](supabase/migrations/20260504120000_public_test_runs.sql); PR03B/C로 `public_result_id`, `user_id`, `claimed_at` 등 채움 가능. |

---

## 3. Problem

1. **`public_test_profiles`는 latest-per-anon** 이라, 같은 anon에서 pilot·run이 바뀌면 과거 이벤트 attribution이 최신 프로필에 끌려갈 수 있다.
2. **Post-auth / session 이벤트**는 `props.pilot_code`가 비는 경우가 있어, run→user 링크 없으면 pilot 필터에서 누락되거나 프로필 폴백에 과도 의존한다.
3. **동일 anon 연속 CTA**는 PR03B마다 새 run row가 생기므로, **시간 경계 없는 anon 매칭**은 이전 run에 이후 이벤트가 붙는 오류가 난다.

---

## 4. Goals

- Pilot 필터 활성 시 attribution 우선순위: **`public_test_runs` → `props.pilot_code` → `public_test_profiles` → `signup_profiles`**.
- 동일 anon에서 **pilot_a vs pilot_b run 분리** 및 **run 간 시간 경계** 반영.
- `public_result_id` / claim 이후 `user_id` 가 있는 이벤트에 대해 **run-first 매칭** 강화.
- **DB 스키마 변경 없음**, **public/client/claim/session 코드 변경 없음**.
- 대시보드 UI는 원칙적으로 유지; 응답 메타는 **optional** 로 설계 가능.

---

## 5. Non-goals

- 새 마이그레이션 / `analytics_events` 스키마 변경.
- `/api/public-test-runs/*`, claim route, persistPublicResult, 인증·결제·세션 생성 로직 변경.
- Admin 대시보드 카드 의미 재정의(수치 해석은 동일, attribution만 정교화).
- 카메라/실행 코어 UX 변경.

---

## 6. Proposed Attribution Priority

각 이벤트 행에 대해 **먼저 만족하는 규칙이 채택**된다.

| 순위 | 소스 | 조건(개요) |
|------|------|------------|
| 1 | `public_test_runs` | 아래 §7 규칙 A/B/C 중 하나로 대상 run 확정 + `run.pilot_code === filterPilotCode` |
| 2 | direct props | 기존: `row.props.pilot_code === pilotCode` |
| 3 | `public_test_profiles` | 기존 맵 로직 |
| 4 | `signup_profiles` | 기존 맵 로직 |

`run.pilot_code` 가 null 인 행은 **pilot 필터 run 매칭 대상에서 제외**(해당 행은 2~4순위로만 매칭 가능).

---

## 7. Event Row Matching Rules

### A. `public_result_id` exact match

- 조건: `row.public_result_id` 가 non-null 이고, 로드된 run 중 `run.public_result_id === row.public_result_id` 인 run이 존재.
- 추가: `run.pilot_code === pilotCode`.
- 시간: **선택적 강화** — run의 `started_at` ≤ `event.created_at` 권장(결과 저장 전 이벤트는 드물지만 이론상 가능). MVP에서는 equality만으로도 실무상 대부분 충분할 수 있음 → 설계서에서는 **MVP: ID 일치만**, 정합성 이슈 시 `created_at >= started_at` 옵션 documented.

### B. `user_id` match after claim

- 전제: `run.user_id === row.user_id` 이고 `run.claimed_at` non-null.
- 시간: `event.created_at >= run.claimed_at`.
- **경계(동일 user 다중 run)**: 해당 user에 대해 `claimed_at` 기준으로 정렬된 후보 run 중,  
  `claimed_at_i <= event.created_at < claimed_at_{i+1}`  
  여기서 `claimed_at_{i+1}` 은 **같은 user에 매핑된 다음 run의 `claimed_at`** (없으면 상한 없음).  
  동일 시각 중복 시에는 `started_at`/`id` 로 타이브레이크 문서화.
- 여러 run이 동일 `public_result_id`에 묶인 경우(PR03B 중복 시나리오)는 헬퍼가 이미 다건 업데이트 가능 — KPI 쪽은 **해당 user·public_result 조합으로 특정 run 행을 고르는 규칙**을 `started_at` 최신 우선 등으로 명시.

### C. `anon_id` time-window match

- 전제: `row.anon_id`(또는 `person_key` `anon:`)가 run의 `anon_id` 와 일치.
- **상한(필수 권장)**: 동일 `anon_id`에 대해 **모든 pilot의 run**을 `started_at` 오름차순 정렬했을 때, 후보 run `R`에 대해  
  `R.started_at <= event.created_at < nextGlobalRun.started_at`  
  여기서 `nextGlobalRun`은 같은 `anon_id`의 바로 다음 run( pilot 무관 ).  
  이렇게 하면 **pilot_b CTA 직후 이벤트가 pilot_a 필터에 anon-window로 붙는 문제**를 차단한다.
- 하한: `event.created_at >= R.started_at`.
- **하한 강화(옵션)**: 이전 글로벌 run이 있고 그 run의 pilot이 필터와 다르면, 여전히 상한만으로 충분한지 검증 — 상한이 다음 run 시작이면 pilot_b 구간은 pilot_a 후보 밖.

### D / E. 기존 폴백

- PR02와 동일: direct props → profiles.

### 질문 1 정리 — 최종 제안

| 규칙 | 용도 | 채택 |
|------|------|------|
| A | result·claim·연계 이벤트 | 채택(MVP 필수) |
| B | post-claim session/app 등 `user_id`만 있는 행 | 채택; claimed_at + 다음 claimed 경계 |
| C | 공개 퍼널 초반 anon 이벤트 | 채택; **글로벌 next-run 상한** 필수 |
| D/E | run 매칭 실패 시 | 기존 유지 |

---

## 8. Run Window / Boundary Rules

| 옵션 | 설명 | 판단 |
|------|------|------|
| 1 무제한 하한만 | `T >= started_at` | 거부 — 다른 pilot/run과 섞임 |
| 2 **다음 run 시작 전** | anon 기준 글로벌 `started_at` 순 상한; user 기준은 다음 `claimed_at` | **권장** |
| 3 고정 기간 | `started_at + 30d` | 비권장(제품 플로우와 불일치 가능) |

**MVP 완화안(구현 복잡도 대비)**: PR03D1에서 **A + B** 만 구현하고 C는 “direct props / profile로만 anon 초기 이벤트 처리” 후 PR03D1.1에서 C 추가하는 분할 가능. 다만 acceptance **“pilot_a가 pilot_b 이벤트 미포함”** 을 만족하려면 **C(anon + 글로벌 상한)** 또는 동등한 분리 규칙이 필요하므로, **PR03D1에 C 포함을 권장**한다.

---

## 9. Admin KPI Function Impact

| 함수 | `fetchAnalyticsEvents` / raw query | `filterRowsByPilotCode` 전 | 비고 |
|------|--------------------------------------|---------------------------|------|
| `getKpiSummary` | 전체 대시보드 이벤트 네임 | 동일 rows → 필터 후 funnel·retention·demographics | Demographics는 이미 필터된 `rows` 전달 — **변경 없음**이 이상적 |
| `getKpiFunnel` | 퍼널별 네임 | 동일 | |
| `getKpiRetention` | (동일 파일 내 retention 이벤트) | 동일 | |
| `getKpiDetails` | 디테일 네임 | 동일 | |
| `getKpiRawEvents` | 페이지 단위 | 동일 필터 — **페이지 한계는 §10** | |

### `created_at` 타입

- **질문 2 답**: run 경계·claim 이후 판별에 **`event.created_at` 필수**.
- [`KpiPilotFilterableEventRow`](src/lib/analytics/admin-kpi-pilot-filter.ts)에 **`created_at: string` 추가**하고, `attachPersonKeysToRows` 이후 모든 `filterRowsByPilotCode` 호출 경로가 이를 만족하는지 타입 검증(현재 `AnalyticsEventRow`는 이미 보유).

### `range` 전달

- Run 배치 로드 시 [**`KpiRange.fromIso` / `toExclusiveIso`**](src/lib/analytics/admin-kpi-types.ts)와 교차하는 run만 로드해 스캔 폭 제한. 이벤트 row 집합에서 추출한 `anonIds`/`userIds`/`publicResultIds`로 **IN 필터 + pilot_code eq** 조합 권장.

---

## 10. Raw Events Pagination Strategy

**현 상태**: 한 페이지 `limit` 안에서 pilot 필터 → 표시 행 수 < `limit` 가능 ([`raw_events_time_window_unchanged_pilot_may_reduce_visible_rows`](src/lib/analytics/admin-kpi.ts)).

| 방안 | 파일럿 전 추천 |
|------|----------------|
| 한계 문구만 강화 | **PR03D1 기본** — 동작 유지, `limitations`/문서에 “pilot 필터 시 페이지 크기 ≠ 매칭 행 수” 명시 |
| pilot 시 fetch 배수 증가 | PR03D2 후보 — 단순하지만 DB 부하 증가 |
| DB에서 run 키로 analytics 좁히기 | 장기 — 스키마不变前提下 SQL 복잡도↑ |

**추천**: **PR03D1 = 문구 유지·최소 변경**; 개선은 **PR03D2 optional**.

---

## 11. Response Meta / Attribution Summary

**제안 타입**(구현 시 [`admin-kpi-types`](src/lib/analytics/admin-kpi-types.ts)):

```ts
export type KpiPilotAttributionSummary = {
  mode: 'public_test_runs_first';
  matched_by_run: number;
  matched_by_direct_props: number;
  matched_by_public_profile: number;
  matched_by_signup_profile: number;
};
```

| 결정 | 제안 |
|------|------|
| PR03D1 범위 | **Optional** — `filters` 확장 또는 `limitations`에 한 줄 요약만 넣는 경량안 택일 가능 |
| Dashboard UI | 변경 없음 — **API JSON만** 노출 |
| Smoke | [`analytics-kpi-pilot-filter-smoke`](scripts/analytics-kpi-pilot-filter-smoke.mjs) 확장 또는 **`analytics-kpi-run-attribution-smoke.mjs`** 신설로 문자열/심볼 검증 |

기존 [`pilot_attribution_mode: 'direct_or_profile'`](src/lib/analytics/admin-kpi-types.ts)는 **`'runs_first'` 또는 `'runs_first_then_legacy'`** 로 의미 업데이트하는 후속 검토(호환: 값 추가만).

---

## 12. Implementation Plan

### 신규 모듈 후보: [`src/lib/analytics/admin-kpi-public-test-runs.ts`](src/lib/analytics/admin-kpi-public-test-runs.ts)

- **`fetchPublicTestRunsForPilotAttribution`**: `pilotCode`(sanitize 완료), row에서 수집한 `anonIds`/`userIds`/`publicResultIds`, `fromIso`/`toExclusiveIso`.
  - 쿼리: `pilot_code = $pilot` AND (`anon_id IN (...) OR user_id IN (...) OR public_result_id IN (...)`) AND `started_at < toExclusiveIso` AND (선택) `started_at >= fromIso - slack` 로 과거 run 경계 포함 slack.
  - **Chunking**: IN 절 크기 제한(예: 100~200).
- 인메모리 자료구조: `anon_id`별 글로벌 run 리스트, `user_id`별 claimed run 리스트, `public_result_id` → run.
- **`rowMatchesPilotRun(row, runsContext): RunMatch | null`** — 위 §7 순서.

### [`filterRowsByPilotCode`](src/lib/analytics/admin-kpi-pilot-filter.ts) 변경 형태

- **최소 변경**: 시그니처 확장  
  `filterRowsByPilotCode(rows, pilotCode, options?: { range?: KpiRange })`  
  `pilotCode` 있을 때만 `fetchPublicTestRunsForPilotAttribution` 호출 후 `rowMatches…` 에서 **run 우선**, 실패 시 기존 `rowMatchesPilotCode`.
- 별도 함수 `filterRowsByPilotCodeWithRuns`는 중복 유지 비용이 있어 **단일 함수 확장 선호**.

### [`admin-kpi.ts`](src/lib/analytics/admin-kpi.ts)

- `getKpi*` / `getKpiRawEvents` 에서 `filterRowsByPilotCode(..., pilotCode, { range })` 로 **`KpiRange` 전달**.
- Limitations 문자열: `kpi_rows_filtered_by_pilot_code_direct_or_profile` → **`kpi_rows_filtered_by_pilot_code_runs_first`** 등으로 명확화(구현 PR에서 카디널리티 정리).

---

## 13. Smoke / Verification Plan

구현 PR 완료 후:

```bash
npm run test:public-test-runs-claim-link
npm run test:public-test-runs-funnel-wiring
npm run test:public-test-runs-foundation
npm run test:analytics-kpi-pilot-filter
npm run test:analytics-pilot-attribution-dedupe
node scripts/analytics-kpi-run-attribution-smoke.mjs   # 신규 권장
npx tsc --noEmit
npm run lint
```

- `lint` / 전역 `tsc` 실패 시 **변경 파일 관련 오류만** 구분 보고.

---

## 14. Risks & Mitigations

| 리스크 | 완화 |
|--------|------|
| 동일 user·겹치는 claimed_at | 타이브레이크 규칙(`started_at`, `id`) 문서화 + 테스트 |
| Run 로드 누락(range·slack) | `fromIso` 이전 시작한 run이 이벤트에 필요하면 **slack 윈도우**(예: range 시작 - 7d) 로 선조회 |
| 성능: IN 리스트 폭발 | Chunk + pilot_code 인덱스 활용 ([`public_test_runs_pilot_started_idx`](supabase/migrations/20260504120000_public_test_runs.sql)) |
| Raw-events 페이지 비어 있음 | §10 한계 유지 + PR03D2에서 개선 검토 |

---

## 15. Acceptance Tests

### Run attribution

- 같은 anon에서 **pilot_a → pilot_b** 순으로 run 시작 시, **pilot_a 필터에 pilot_b 구간 이벤트 미포함**(§7-C 글로벌 상한).
- `public_result_id` 연결 이벤트는 **해당 run의 pilot** 과 일치할 때만 포함.
- Claim 후 `user_id` 연결 run은 **post-claim** 이벤트를 포함 가능(B).
- `props.pilot_code` 없는 session/app 이벤트도 **B 또는 C** 로 포함 가능.
- Run 매칭 실패 시 **PR02 폴백** 유지.

### Regression

- `pilot_code` 미지정 시 기존과 동일 동작.
- 잘못된 pilot_code → **400 [`InvalidKpiPilotCodeError`](src/lib/analytics/admin-kpi-pilot-filter.ts)** 유지.
- 대시보드 UI 깨짐 없음.
- DB migration 없음; public/client/claim/session 미변경.

### 수동 E2E (요약)

PR03B+C로 `public_test_runs` 채운 뒤, 동일 anon 두 pilot 연속 시나리오에서 Admin KPI pilot 필터 카운트가 기대와 일치하는지 확인.

---

## 16. Open Questions

1. **Rule A** 에 `event.created_at >= run.started_at` 를 MVP에 포함할지(거의 항상 참이면 생략 가능).
2. **`pilot_attribution_mode`** 문자열을 클라이언트/외부 연동이 소비하는지 — 값 추가 시 호환 정책.
3. Run 로드 **slack** 일수(7d vs range 비율) — 운영 데이터로 튜닝.

---

## PR split 판단

| PR | 내용 |
|----|------|
| **PR03D1 (권장 최소 배포)** | `admin-kpi-public-test-runs.ts` + `filterRowsByPilotCode` run-first + `KpiPilotFilterableEventRow.created_at` + `admin-kpi.ts` range 전달 + limitations/summary optional + smoke/tsc |
| **PR03D2 (optional)** | Raw-events pagination 완화; attribution summary UI; DB 쿼리 최적화 |

**파일럿 전**: PR03D1만으로도 attribution 정확도 이득이 크다.

---

## 산출물

- 본 문서: [`docs/pr/PR-KPI-PUBLIC-TEST-RUNS-03D.plan.md`](docs/pr/PR-KPI-PUBLIC-TEST-RUNS-03D.plan.md)
- 구현은 별도 PR에서 수행; **본 커밋은 문서만** 포함.
