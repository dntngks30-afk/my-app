-- media_ref: TEXT → JSONB (Mux SSOT)
-- 기존 media_ref가 모두 null → USING NULL로 안전 변환
-- Mux media_ref 예: {"provider":"mux","playback_id":"xxx","thumb":"..."}

ALTER TABLE public.exercise_templates
  ALTER COLUMN media_ref TYPE JSONB
  USING NULL;

COMMENT ON COLUMN public.exercise_templates.media_ref IS 'JSONB: {provider, playback_id|id, thumb?, start?, end?}. provider=mux|youtube|vimeo|legacy';
