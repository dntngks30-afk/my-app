-- PR-20: Exercise Template Metadata v2
-- balance_demand, complexity
-- additive only, nullable. target_vector 유지, 중복 필드 없음.

ALTER TABLE public.exercise_templates
  ADD COLUMN IF NOT EXISTS balance_demand TEXT,
  ADD COLUMN IF NOT EXISTS complexity TEXT;

COMMENT ON COLUMN public.exercise_templates.balance_demand IS 'low|medium|high. 균형 요구도. first session/deconditioned/asymmetry/protected 시 high 제외';
COMMENT ON COLUMN public.exercise_templates.complexity IS 'low|medium|high. 동작 복잡도. first session/protected 시 high 제외';
