-- PR-M18-RATIONALE-POLISH-01: M18 — ankle/calf activation, lower support (not primary Main anchor)
-- Additive UPDATE only.

UPDATE public.exercise_templates
SET
  phase = 'accessory',
  target_vector = ARRAY['lower_mobility', 'lower_stability']::text[],
  difficulty = 'low',
  avoid_if_pain_mode = '{}',
  progression_level = 1
WHERE id = 'M18';
