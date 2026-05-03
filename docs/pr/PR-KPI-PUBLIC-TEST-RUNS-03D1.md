# PR-KPI-PUBLIC-TEST-RUNS-03D1

## Summary

- Admin KPI `pilot_code` 필터가 **`public_test_runs` 기반 attribution을 먼저** 적용하고, 판정은 `include` / `exclude` / `unknown` 3상태다.
- `exclude`인 행은 **legacy(props / `public_test_profiles` / `signup_profiles`) 폴백을 타지 않는다** — 다른 pilot run으로 확정된 경우 데이터 섞임을 막는다.
- `unknown`만 기존 PR02와 동일한 legacy 매칭을 사용한다.

## Scope

- [`src/lib/analytics/admin-kpi-public-test-runs.ts`](src/lib/analytics/admin-kpi-public-test-runs.ts) — run 배치 로드·경계 판정.
- [`src/lib/analytics/admin-kpi-pilot-filter.ts`](src/lib/analytics/admin-kpi-pilot-filter.ts) — `created_at` 필수, runs-first + legacy.
- [`src/lib/analytics/admin-kpi.ts`](src/lib/analytics/admin-kpi.ts) — `filterRowsByPilotCode(..., { range })`, limitations·`pilot_attribution_mode`.
- [`src/lib/analytics/admin-kpi-types.ts`](src/lib/analytics/admin-kpi-types.ts) — `runs_first_then_legacy`.
- [`scripts/analytics-kpi-run-attribution-smoke.mjs`](scripts/analytics-kpi-run-attribution-smoke.mjs), `npm run test:analytics-kpi-run-attribution`.

## Non-goals

- DB migration, public/client/claim/session/payment 변경.
- Raw-events 페이지네이션 재설계(PR03D2).
- 대시보드 UI 변경.

## Attribution rules (요약)

1. **`public_result_id`**: 매칭 run 중 최신 `started_at` 기준으로 pilot 판정; 상이 pilot → `exclude`.
2. **`user_id` + `claimed_at`**: claimed run을 `claimed_at` 오름차순으로 두고 `claimed_at <= event < next.claimed_at` 구간의 active run으로 판정.
3. **`anon_id`**: 동일 anon 전체 run을 `started_at` 오름차순으로 두고 `started_at <= event < next_global_run.started_at`(pilot 무관)으로 active run 결정.
4. 매칭 불가 → `unknown` → legacy.

Run fetch는 KPI `range` 기준 **30일 lookback** 하한과 `started_at < toExclusiveIso` 상한으로 스캔 폭을 제한한다.

## Verification

```bash
npm run test:analytics-kpi-run-attribution
npm run test:analytics-kpi-pilot-filter
npm run test:public-test-runs-claim-link
npm run test:public-test-runs-funnel-wiring
npm run test:public-test-runs-foundation
npm run test:analytics-pilot-attribution-dedupe
npx tsc --noEmit
npm run lint
```

### Acceptance

- `public_result_id`가 특정 pilot run에 묶이면 해당 pilot 필터에 포함; **다른 pilot run이면 `exclude`** 로 legacy 미적용.
- 동일 anon에서 pilot_a 이후 pilot_b run이 있으면 pilot_a 필터가 **pilot_b 구간 이벤트를 anon 경계로 제외**할 수 있다.
- `pilot_code` 미지정 시 동작은 기존과 동일.
- invalid pilot_code → 400 유지.

### 수동 E2E

문서 PR03D 계획서 및 본 PR 요약의 시나리오(두 pilot 연속·claim 후 user 이벤트)를 `/admin/kpi`에서 교차 검증.
