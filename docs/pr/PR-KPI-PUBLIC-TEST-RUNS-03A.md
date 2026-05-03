# PR-KPI-PUBLIC-TEST-RUNS-03A

## Summary

- **`public_test_runs`** additive migration: immutable public funnel run backbone for pilot KPI (does not replace `analytics_events` or `public_test_profiles`).
- **Server-only helpers** in `src/lib/public-test-runs/server.ts` (service role, best-effort, no throw).
- **Static smoke** `npm run test:public-test-runs-foundation`.

No public client wiring, no API routes, no admin dashboard changes in this PR.

## Scope

| In scope | Out of scope |
|----------|----------------|
| Migration: table, checks, indexes, RLS enabled, no anon policies | `/api/public-test-runs/start`, `/mark`, … |
| `updated_at` trigger (table-local function, repo pattern) | Landing CTA / survey / result page wiring |
| `startPublicTestRun`, milestone/refine/result/user link helpers | Claim route linkage |
| Smoke script + package.json script | Admin KPI filter using `public_test_runs` |
| This doc | Public result API body extensions |

## Non-goals

- Changing `public_test_profiles`, `analytics_events`, `/api/analytics/track`, `trackEvent`, `logAnalyticsEvent`.
- Any UX change on public marketing or `/app/*` execution shell.

## Verification

PowerShell / CI-friendly:

```bash
npm run test:public-test-runs-foundation
npm run test:analytics-kpi-pilot-filter
npm run test:analytics-pilot-attribution-dedupe
npx tsc --noEmit
npm run lint
```

Note: `npm run lint` or global `tsc` may fail due to pre-existing repo issues; classify failures by whether touched files are involved.

## Acceptance checklist

### Migration

- [x] `public_test_runs` added via additive migration only.
- [x] Existing tables unchanged by this file.
- [x] RLS enabled; no public anon read/write policies.
- [x] `pilot_code`, `result_stage`, `refine_choice` check constraints.
- [x] Indexes: pilot+started, anon+started, public_result, user+started, created.

### Server helper

- [x] `startPublicTestRun` validates run UUID + anon + sanitized pilot code.
- [x] PK conflict: no overwrite of existing row; idempotent when same `anon_id`.
- [x] `markPublicTestRunMilestone` updates only `id` + `anon_id` match; allowlisted milestones; first timestamp wins.
- [x] `linkPublicTestRunToResult` skips if `public_result_id` already set to a different id.
- [x] `linkPublicTestRunToUserByPublicResult` documented for server-derived `userId` only (PR03C).
- [x] All helpers return `{ ok: false, … }` on failure (no throw).

### Scope guard

- [x] No public client file edits required for this PR.
- [x] No new API routes.
- [x] No admin KPI dashboard edits.

## Follow-ups

- **PR03B**: CTA run start, funnel marks, link to `public_results`.
- **PR03C**: Claim route → `linkPublicTestRunToUserByPublicResult`.
- **PR03D**: Admin KPI run attribution / filters.
