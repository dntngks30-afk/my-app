-- ============================================================
-- PR-SESSION-ADAPTIVE-01: session_adaptive_summaries modifier columns
-- 202603201700_session_adaptive_summaries_modifier.sql
-- ============================================================
-- Store difficulty_adjustment, intensity_adjustment, caution_bias
-- for adaptive tuning and analytics. Additive only.
-- ============================================================

ALTER TABLE public.session_adaptive_summaries ADD COLUMN IF NOT EXISTS difficulty_adjustment SMALLINT NULL;
ALTER TABLE public.session_adaptive_summaries ADD COLUMN IF NOT EXISTS intensity_adjustment SMALLINT NULL;
ALTER TABLE public.session_adaptive_summaries ADD COLUMN IF NOT EXISTS caution_bias BOOLEAN NULL;

COMMENT ON COLUMN public.session_adaptive_summaries.difficulty_adjustment IS 'PR-SESSION-ADAPTIVE-01: -1 down, 0 neutral, 1 up from completion_ratio';
COMMENT ON COLUMN public.session_adaptive_summaries.intensity_adjustment IS 'PR-SESSION-ADAPTIVE-01: -1 down, 0 neutral, 1 up from avg_rpe';
COMMENT ON COLUMN public.session_adaptive_summaries.caution_bias IS 'PR-SESSION-ADAPTIVE-01: true when discomfort signal present';
