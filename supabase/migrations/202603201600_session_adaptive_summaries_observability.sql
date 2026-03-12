-- ============================================================
-- PR-03: session_adaptive_summaries observability columns
-- 202603201600_session_adaptive_summaries_observability.sql
-- ============================================================
-- Add ratio_denom, rpe_sample_count, discomfort_sample_count, summary_status
-- for evaluator observability. Additive only.
-- ============================================================

ALTER TABLE public.session_adaptive_summaries ADD COLUMN IF NOT EXISTS ratio_denom INT NOT NULL DEFAULT 0;
ALTER TABLE public.session_adaptive_summaries ADD COLUMN IF NOT EXISTS rpe_sample_count INT NOT NULL DEFAULT 0;
ALTER TABLE public.session_adaptive_summaries ADD COLUMN IF NOT EXISTS discomfort_sample_count INT NOT NULL DEFAULT 0;
ALTER TABLE public.session_adaptive_summaries ADD COLUMN IF NOT EXISTS summary_status TEXT NOT NULL DEFAULT 'partial';

COMMENT ON COLUMN public.session_adaptive_summaries.ratio_denom IS 'PR-03: denominator used for completion_ratio';
COMMENT ON COLUMN public.session_adaptive_summaries.rpe_sample_count IS 'PR-03: count of valid RPE samples used';
COMMENT ON COLUMN public.session_adaptive_summaries.discomfort_sample_count IS 'PR-03: count of valid discomfort samples used';
COMMENT ON COLUMN public.session_adaptive_summaries.summary_status IS 'PR-03: full | partial | insufficient_data';
