-- PR-ALG-15: lower_mobility / stable-deconditioned baseline analysis
-- Read-only. deep_test_attempts.scores->derived 기준 집계.
-- Filter: status=final, scoring_version=deep_v3

-- 1. 전체 분포 (최근 30일)
WITH base AS (
  SELECT
    d.id,
    d.finalized_at,
    (d.scores->'derived'->>'primary_type') AS primary_type,
    (d.scores->'derived'->>'secondary_type') AS secondary_type,
    (d.scores->'derived'->'priority_vector') AS pv
  FROM deep_test_attempts d
  WHERE d.status = 'final'
    AND d.scoring_version = 'deep_v3'
    AND d.scores->'derived' IS NOT NULL
    AND d.finalized_at >= (now() - interval '30 days')
  ORDER BY d.finalized_at DESC NULLS LAST
  LIMIT 500
)
SELECT
  COUNT(*) AS total_final,
  COUNT(*) FILTER (WHERE primary_type = 'STABLE') AS stable_count,
  COUNT(*) FILTER (WHERE primary_type = 'DECONDITIONED') AS deconditioned_count,
  COUNT(*) FILTER (WHERE primary_type = 'LOWER_MOBILITY_RESTRICTION') AS lower_mobility_primary_count,
  COUNT(*) FILTER (WHERE secondary_type = 'LOWER_MOBILITY_RESTRICTION') AS lower_mobility_secondary_count,
  ROUND(100.0 * COUNT(*) FILTER (WHERE primary_type = 'STABLE') / NULLIF(COUNT(*), 0), 2) AS stable_rate_pct,
  ROUND(100.0 * COUNT(*) FILTER (WHERE primary_type = 'DECONDITIONED') / NULLIF(COUNT(*), 0), 2) AS deconditioned_rate_pct,
  ROUND(100.0 * COUNT(*) FILTER (WHERE primary_type = 'LOWER_MOBILITY_RESTRICTION') / NULLIF(COUNT(*), 0), 2) AS lower_mobility_primary_rate_pct
FROM base;

-- 2. lower_mobility priority_vector 비율 (non-zero)
WITH base AS (
  SELECT
    (d.scores->'derived'->'priority_vector'->>'lower_mobility')::numeric AS lm,
    (d.scores->'derived'->'priority_vector'->>'lower_stability')::numeric AS ls,
    (d.scores->'derived'->'priority_vector'->>'trunk_control')::numeric AS tc,
    (d.scores->'derived'->>'primary_type') AS primary_type
  FROM deep_test_attempts d
  WHERE d.status = 'final'
    AND d.scoring_version = 'deep_v3'
    AND d.scores->'derived' IS NOT NULL
    AND d.finalized_at >= (now() - interval '30 days')
  LIMIT 500
)
SELECT
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE lm > 0.01) AS lower_mobility_nonzero,
  COUNT(*) FILTER (WHERE lm > 0.01 AND ls > 0.01) AS lm_plus_ls_overlap,
  COUNT(*) FILTER (WHERE lm > 0.01 AND tc > 0.01) AS lm_plus_tc_overlap,
  ROUND(100.0 * COUNT(*) FILTER (WHERE lm > 0.01) / NULLIF(COUNT(*), 0), 2) AS lower_mobility_nonzero_pct
FROM base;

-- 3. Sample: lower_mobility top cases
SELECT
  d.id,
  (d.scores->'derived'->>'primary_type') AS primary_type,
  (d.scores->'derived'->>'secondary_type') AS secondary_type,
  (d.scores->'derived'->'priority_vector') AS priority_vector,
  d.finalized_at
FROM deep_test_attempts d
WHERE d.status = 'final'
  AND d.scoring_version = 'deep_v3'
  AND (d.scores->'derived'->'priority_vector'->>'lower_mobility')::numeric > 0.01
ORDER BY (d.scores->'derived'->'priority_vector'->>'lower_mobility')::numeric DESC
LIMIT 20;

-- 4. Sample: STABLE cases
SELECT
  d.id,
  (d.scores->'derived'->>'primary_type') AS primary_type,
  (d.scores->'derived'->'priority_vector') AS priority_vector,
  d.finalized_at
FROM deep_test_attempts d
WHERE d.status = 'final'
  AND d.scoring_version = 'deep_v3'
  AND (d.scores->'derived'->>'primary_type') = 'STABLE'
ORDER BY d.finalized_at DESC NULLS LAST
LIMIT 20;

-- 5. Sample: DECONDITIONED cases
SELECT
  d.id,
  (d.scores->'derived'->>'primary_type') AS primary_type,
  (d.scores->'derived'->'priority_vector') AS priority_vector,
  d.finalized_at
FROM deep_test_attempts d
WHERE d.status = 'final'
  AND d.scoring_version = 'deep_v3'
  AND (d.scores->'derived'->>'primary_type') = 'DECONDITIONED'
ORDER BY d.finalized_at DESC NULLS LAST
LIMIT 20;
