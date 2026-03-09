-- PR-ALG-14: Real DB pain_mode active vs legacy analysis
-- Read-only. deep_test_attempts.scores->shadow_compare 기준 집계.
-- Run with: psql or Supabase SQL editor. Filter by candidate_name='pain_mode_legacy'.

-- 1. 전체 분포 (최근 N일, limit)
-- Replace :days, :limit as needed. Default 30 days, 500 rows.
WITH sc AS (
  SELECT
    d.id AS attempt_id,
    d.user_id,
    d.finalized_at,
    (d.scores->'shadow_compare'->>'candidate_name') AS candidate_name,
    (d.scores->'shadow_compare'->>'active_pain_mode') AS active_pain_mode,
    (d.scores->'shadow_compare'->>'shadow_pain_mode') AS shadow_pain_mode,
    (d.scores->'shadow_compare'->>'active_primary_type') AS active_primary_type,
    (d.scores->'shadow_compare'->>'shadow_primary_type') AS shadow_primary_type,
    (d.scores->'shadow_compare'->'diff_flags') AS diff_flags,
    (d.scores->'shadow_compare'->>'comparison_reason') AS comparison_reason
  FROM deep_test_attempts d
  WHERE d.status = 'final'
    AND d.scores->'shadow_compare' IS NOT NULL
    AND (d.scores->'shadow_compare'->>'candidate_name') = 'pain_mode_legacy'
    AND d.finalized_at >= (now() - interval '30 days')
  ORDER BY d.finalized_at DESC NULLS LAST
  LIMIT 500
)
SELECT
  COUNT(*) AS total_compared,
  COUNT(*) FILTER (WHERE diff_flags::text LIKE '%pain_mode_changed%') AS pain_mode_changed,
  ROUND(100.0 * COUNT(*) FILTER (WHERE diff_flags::text LIKE '%pain_mode_changed%') / NULLIF(COUNT(*), 0), 2) AS changed_rate_pct
FROM sc;

-- 2. Direction 분포
WITH sc AS (
  SELECT
    (d.scores->'shadow_compare'->>'active_pain_mode') AS active_pain_mode,
    (d.scores->'shadow_compare'->>'shadow_pain_mode') AS shadow_pain_mode,
    (d.scores->'shadow_compare'->'diff_flags') AS diff_flags
  FROM deep_test_attempts d
  WHERE d.status = 'final'
    AND d.scores->'shadow_compare' IS NOT NULL
    AND (d.scores->'shadow_compare'->>'candidate_name') = 'pain_mode_legacy'
    AND d.finalized_at >= (now() - interval '30 days')
  LIMIT 500
)
SELECT
  active_pain_mode || ' -> ' || shadow_pain_mode AS direction,
  COUNT(*) AS cnt
FROM sc
WHERE diff_flags::text LIKE '%pain_mode_changed%'
GROUP BY 1
ORDER BY 2 DESC;

-- 3. 안정성 체크: protected -> caution (high-risk 변화)
WITH sc AS (
  SELECT
    (d.scores->'shadow_compare'->>'active_pain_mode') AS active_pain_mode,
    (d.scores->'shadow_compare'->>'shadow_pain_mode') AS shadow_pain_mode
  FROM deep_test_attempts d
  WHERE d.status = 'final'
    AND d.scores->'shadow_compare' IS NOT NULL
    AND (d.scores->'shadow_compare'->>'candidate_name') = 'pain_mode_legacy'
    AND d.finalized_at >= (now() - interval '30 days')
  LIMIT 500
)
SELECT COUNT(*) AS protected_to_caution_cnt
FROM sc
WHERE active_pain_mode = 'protected' AND shadow_pain_mode = 'caution';

-- 4. Sample rows (최근 N건)
SELECT
  d.id AS attempt_id,
  (d.scores->'shadow_compare'->>'active_pain_mode') AS active_pain_mode,
  (d.scores->'shadow_compare'->>'shadow_pain_mode') AS shadow_pain_mode,
  (d.scores->'shadow_compare'->'diff_flags') AS diff_flags,
  (d.scores->'shadow_compare'->>'comparison_reason') AS comparison_reason,
  d.finalized_at
FROM deep_test_attempts d
WHERE d.status = 'final'
  AND d.scores->'shadow_compare' IS NOT NULL
  AND (d.scores->'shadow_compare'->>'candidate_name') = 'pain_mode_legacy'
  AND (d.scores->'shadow_compare'->'diff_flags')::text LIKE '%pain_mode_changed%'
ORDER BY d.finalized_at DESC NULLS LAST
LIMIT 20;
