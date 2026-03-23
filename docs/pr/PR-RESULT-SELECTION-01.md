# PR-RESULT-SELECTION-01 — Prefer refined claimed public result for execution truth

## Goal

`getLatestClaimedPublicResultForUser` selects which **claimed** `public_results` row drives session create and readiness analysis input. Previously the choice was **`claimed_at DESC` only**, so a **newer baseline claim** could override an **older refined** claim.

This PR adds a **loader-only** ranking: **refined before baseline**, then **newer `claimed_at` within the same stage**. Downstream types and consumers are unchanged.

## Selection policy

1. Load up to **80** claimed rows for the user (`claimed_at IS NOT NULL`), most recent first from DB (bounded fetch).
2. Sort in memory:
   - `result_stage === 'refined'` before `baseline` (unknown stages sort last and are skipped with a warning).
   - Within the same stage, **newer `claimed_at` first**.
3. Walk the ranked list; for each row, apply existing **stage** and **UnifiedDeepResultV2** validation; return the **first** that passes.

## Tradeoff (accepted)

An **older refined** claim can beat a **newer baseline** claim when both are in the candidate set. That is intentional: refined is treated as the stronger execution signal when both are valid and claimed.

## Limits

- At most **80** claimed rows are considered. Users with more than 80 claimed rows could theoretically omit a row outside this window — unlikely in practice.

## Files

- `src/lib/public-results/getLatestClaimedPublicResultForUser.ts` only (no session create / readiness / claim changes).
