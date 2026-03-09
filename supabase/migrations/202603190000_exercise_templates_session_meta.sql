-- PR-ALG-04: exercise_templates session composer 메타 최소 추가
-- phase, target_vector, difficulty, avoid_if_pain_mode, progression_level
-- additive only, nullable, 기존 row 보존

ALTER TABLE public.exercise_templates
  ADD COLUMN IF NOT EXISTS phase TEXT,
  ADD COLUMN IF NOT EXISTS target_vector TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS difficulty TEXT,
  ADD COLUMN IF NOT EXISTS avoid_if_pain_mode TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS progression_level SMALLINT;

COMMENT ON COLUMN public.exercise_templates.phase IS 'prep|main|accessory|cooldown';
COMMENT ON COLUMN public.exercise_templates.target_vector IS 'lower_stability|lower_mobility|upper_mobility|trunk_control|asymmetry|deconditioned';
COMMENT ON COLUMN public.exercise_templates.difficulty IS 'low|medium|high (동작 난이도, level과 별개)';
COMMENT ON COLUMN public.exercise_templates.avoid_if_pain_mode IS 'caution|protected: 해당 pain_mode에서 제외';
COMMENT ON COLUMN public.exercise_templates.progression_level IS '1-3: target_vector 내 progression 순서';
