# PR-KPI-PUBLIC-TEST-RUNS-03B

## Summary

- 랜딩 CTA에서 클라이언트 생성 `runId`로 active run을 저장하고 `/api/public-test-runs/start`로 best-effort 동기화한다.
- 설문·refine bridge에서 `/api/public-test-runs/mark`로 마일스톤·정제 선택을 기록한다.
- `persistPublicResult()`가 선택 필드로 run id를 실어 보내고, `/api/public-results`에서 저장 성공 후 `linkPublicTestRunToResult()`로 `public_result_id`를 연결한다.

## Scope

- [`src/lib/public-test-runs/client.ts`](src/lib/public-test-runs/client.ts) — localStorage + start/mark fetch (`keepalive`, `cache: 'no-store'`).
- [`src/app/api/public-test-runs/start/route.ts`](src/app/api/public-test-runs/start/route.ts), [`mark/route.ts`](src/app/api/public-test-runs/mark/route.ts) — 관측용 POST, 응답에서 raw DB 메시지 비노출.
- [`src/app/(main)/page.tsx`](src/app/(main)/page.tsx), [`survey/page.tsx`](src/app/movement-test/survey/page.tsx), [`refine-bridge/page.tsx`](src/app/movement-test/refine-bridge/page.tsx) — 기존 `trackEvent` 유지, run 헬퍼만 추가.
- [`src/lib/public-results/persistPublicResult.ts`](src/lib/public-results/persistPublicResult.ts) — `'use client'` 및 body 확장.
- [`src/app/api/public-results/route.ts`](src/app/api/public-results/route.ts) — 기존 201 응답 계약 유지, run 링크는 별도 try/catch.

## Non-goals

- claim / user linkage (PR03C).
- auth·결제·온보딩·세션·앱 홈 마일스톤.
- admin KPI가 `public_test_runs`를 우선 사용하도록 변경 (PR03D 등).
- DB 마이그레이션, 카메라 엔진·실행 코어 변경.

## Verification

```bash
npm run test:public-test-runs-funnel-wiring
npm run test:public-test-runs-foundation
npm run test:analytics-kpi-pilot-filter
npm run test:analytics-pilot-attribution-dedupe
npx tsc --noEmit
npm run lint
```

(`lint` / 전역 `tsc` 실패는 기존 이슈일 수 있음 — 이번 PR 변경 파일과 구분해 보고.)

### Acceptance (요약)

**API**

- `/api/public-test-runs/start` · `/mark`는 주로 HTTP 200 + `{ ok }`; Cache-Control: `no-store`.
- 성공/실패 reason은 화이트리스트 밖이면 `write_failed` 등으로 정규화, Postgres 문자열 그대로 노출 안 함.

**Client**

- CTA 직후 active run이 localStorage에 남고, `keepalive`로 네비게이션 중에도 요청이 나갈 수 있다.
- run API 실패해도 다음 화면 이동은 막지 않는다.

**Result linkage**

- `publicTestRunAnonId`가 요청 `anonId`와 일치할 때만 `linkPublicTestRunToResult` 호출.
- 링크 실패해도 public result 저장 201 응답은 유지.

### 수동 E2E

1. 브라우저 localStorage 초기화.
2. `/?pilot=pilot_test_001` 접속 후 CTA 클릭 → Supabase `public_test_runs` 행 생성 확인.
3. 설문 시작/완료 → `survey_started_at`, `survey_completed_at` 확인.
4. refine bridge에서 baseline 선택 → `refine_choice = baseline` 확인.
5. baseline 결과 저장 후 `public_result_id`, `result_stage`, `result_viewed_at` 확인.
6. 동일 브라우저에서 다시 `/` → CTA → 새 run 행 생성 확인.

```sql
select *
from public.public_test_runs
where pilot_code = 'pilot_test_001'
order by started_at desc
limit 10;
```
