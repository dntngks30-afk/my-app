# PR-KPI-PUBLIC-TEST-RUNS-03C

## Summary

- Claim API 성공(`claimed` / `already_owned` 모두) 직후 `linkPublicTestRunToUserByPublicResult()`로 `public_test_runs`에 서버 인증 `user_id`·`claimed_at`을 best-effort 연결한다.
- `public_result_id`는 `output.id` 기준이며, 실패해도 claim HTTP 응답 본문은 기존과 동일하다.
- 관측 실패는 `console.warn`만 사용하고 응답에 raw DB 메시지를 넣지 않는다.

## Scope

- [`src/app/api/public-results/[id]/claim/route.ts`](src/app/api/public-results/[id]/claim/route.ts)
- [`scripts/public-test-runs-claim-link-smoke.mjs`](scripts/public-test-runs-claim-link-smoke.mjs)
- `package.json` script `test:public-test-runs-claim-link`

## Non-goals

- DB migration, `public_test_profiles` / analytics schema 변경
- `/api/public-test-runs/start` · `/mark` 변경
- `claimPublicResult` 내부 로직 변경
- auth·결제·세션·앱 홈 마일스톤, admin KPI·대시보드 UI

## Verification

```bash
npm run test:public-test-runs-claim-link
npm run test:public-test-runs-funnel-wiring
npm run test:public-test-runs-foundation
npm run test:analytics-kpi-pilot-filter
npm run test:analytics-pilot-attribution-dedupe
npx tsc --noEmit
npm run lint
```

### Acceptance (요약)

**Claim linkage**

- `claimPublicResult()` 성공 직후 `linkPublicTestRunToUserByPublicResult` 호출.
- `outcome === 'claimed'`와 `already_owned` 모두에서 linkage 시도.
- 매칭 run이 없거나 helper가 `{ ok: false }`여도 claim 성공 JSON은 그대로.
- `userId`는 `getCurrentUserId(request)` 값만 사용 (body의 user_id 미사용).
- 응답에 `runLinked` 등 신규 필드 없음.
- `public_result_claim_success` 및 `dedupe_key: public_result_claim_success:${userId}:${output.id}` 유지.

**Scope**

- public 클라이언트·persistPublicResult·session/payment 로직 변경 없음.

### 수동 E2E

1. PR03B 흐름으로 `public_test_runs.public_result_id`가 채워진 상태 준비.
2. 해당 결과를 로그인 후 claim.
3. 아래로 `user_id`·`claimed_at` 채워짐 확인, claim 응답 형식은 기존과 동일.

```sql
select id, public_result_id, user_id, claimed_at
from public.public_test_runs
where public_result_id is not null
order by started_at desc
limit 5;

select id, public_result_id, user_id, claimed_at
from public.public_test_runs
where public_result_id = '<PUBLIC_RESULT_ID>';
```
