-- PR-TEMPLATE-48-METADATA-ALIGN-01: M29~M48 session-composer fields + minimal semantic fix for renames
-- M01~M28 unchanged. Additive only.

-- Semantic alignment (name manifest vs renames) — M30, M44, M46
UPDATE public.exercise_templates SET
  contraindications = ARRAY['lower_back_pain', 'wrist_load']::text[]
WHERE id = 'M30';

UPDATE public.exercise_templates SET
  contraindications = ARRAY['knee_load', 'deep_squat']::text[]
WHERE id = 'M44';

UPDATE public.exercise_templates SET
  focus_tags = ARRAY['upper_back_activation', 'shoulder_mobility', 'thoracic_mobility']::text[]
WHERE id = 'M46';
-- M46: shoulder_overhead remains in contraindications from original seed; do not clear.

-- M29~M48: phase, target_vector, difficulty, avoid_if_pain_mode, progression_level
UPDATE public.exercise_templates SET
  phase = 'main',
  target_vector = ARRAY['trunk_control']::text[],
  difficulty = 'medium',
  avoid_if_pain_mode = '{}',
  progression_level = 2
WHERE id = 'M29';

UPDATE public.exercise_templates SET
  phase = 'main',
  target_vector = ARRAY['trunk_control']::text[],
  difficulty = 'medium',
  avoid_if_pain_mode = '{}',
  progression_level = 2
WHERE id = 'M30';

UPDATE public.exercise_templates SET
  phase = 'main',
  target_vector = ARRAY['trunk_control']::text[],
  difficulty = 'medium',
  avoid_if_pain_mode = '{}',
  progression_level = 2
WHERE id = 'M31';

UPDATE public.exercise_templates SET
  phase = 'main',
  target_vector = ARRAY['trunk_control']::text[],
  difficulty = 'high',
  avoid_if_pain_mode = ARRAY['caution', 'protected']::text[],
  progression_level = 2
WHERE id = 'M32';

UPDATE public.exercise_templates SET
  phase = 'main',
  target_vector = ARRAY['trunk_control']::text[],
  difficulty = 'medium',
  avoid_if_pain_mode = ARRAY['caution']::text[],
  progression_level = 2
WHERE id = 'M33';

UPDATE public.exercise_templates SET
  phase = 'main',
  target_vector = ARRAY['lower_stability', 'trunk_control']::text[],
  difficulty = 'medium',
  avoid_if_pain_mode = '{}',
  progression_level = 2
WHERE id = 'M34';

UPDATE public.exercise_templates SET
  phase = 'main',
  target_vector = ARRAY['lower_stability']::text[],
  difficulty = 'high',
  avoid_if_pain_mode = ARRAY['protected']::text[],
  progression_level = 3
WHERE id = 'M35';

UPDATE public.exercise_templates SET
  phase = 'main',
  target_vector = ARRAY['lower_stability', 'asymmetry']::text[],
  difficulty = 'medium',
  avoid_if_pain_mode = ARRAY['caution']::text[],
  progression_level = 2
WHERE id = 'M36';

UPDATE public.exercise_templates SET
  phase = 'main',
  target_vector = ARRAY['lower_stability']::text[],
  difficulty = 'high',
  avoid_if_pain_mode = ARRAY['caution', 'protected']::text[],
  progression_level = 3
WHERE id = 'M37';

UPDATE public.exercise_templates SET
  phase = 'main',
  target_vector = ARRAY['lower_stability', 'asymmetry']::text[],
  difficulty = 'high',
  avoid_if_pain_mode = ARRAY['caution', 'protected']::text[],
  progression_level = 3
WHERE id = 'M38';

UPDATE public.exercise_templates SET
  phase = 'main',
  target_vector = ARRAY['lower_stability']::text[],
  difficulty = 'high',
  avoid_if_pain_mode = ARRAY['protected']::text[],
  progression_level = 3
WHERE id = 'M39';

UPDATE public.exercise_templates SET
  phase = 'main',
  target_vector = ARRAY['lower_stability', 'asymmetry']::text[],
  difficulty = 'high',
  avoid_if_pain_mode = ARRAY['caution', 'protected']::text[],
  progression_level = 3
WHERE id = 'M40';

UPDATE public.exercise_templates SET
  phase = 'prep',
  target_vector = ARRAY['lower_mobility', 'lower_stability']::text[],
  difficulty = 'low',
  avoid_if_pain_mode = '{}',
  progression_level = 1
WHERE id = 'M41';

UPDATE public.exercise_templates SET
  phase = 'accessory',
  target_vector = ARRAY['lower_mobility', 'trunk_control']::text[],
  difficulty = 'low',
  avoid_if_pain_mode = '{}',
  progression_level = 1
WHERE id = 'M42';

UPDATE public.exercise_templates SET
  phase = 'accessory',
  target_vector = ARRAY['lower_mobility', 'trunk_control']::text[],
  difficulty = 'medium',
  avoid_if_pain_mode = ARRAY['caution']::text[],
  progression_level = 2
WHERE id = 'M43';

UPDATE public.exercise_templates SET
  phase = 'prep',
  target_vector = ARRAY['lower_mobility']::text[],
  difficulty = 'medium',
  avoid_if_pain_mode = ARRAY['caution', 'protected']::text[],
  progression_level = 2
WHERE id = 'M44';

UPDATE public.exercise_templates SET
  phase = 'main',
  target_vector = ARRAY['upper_mobility', 'trunk_control']::text[],
  difficulty = 'medium',
  avoid_if_pain_mode = ARRAY['caution']::text[],
  progression_level = 2
WHERE id = 'M45';

UPDATE public.exercise_templates SET
  phase = 'main',
  target_vector = ARRAY['upper_mobility']::text[],
  difficulty = 'medium',
  avoid_if_pain_mode = ARRAY['caution']::text[],
  progression_level = 2
WHERE id = 'M47';

UPDATE public.exercise_templates SET
  phase = 'accessory',
  target_vector = ARRAY['upper_mobility']::text[],
  difficulty = 'low',
  avoid_if_pain_mode = '{}',
  progression_level = 1
WHERE id = 'M48';

-- M45/M46/47: M46 already set focus_tags above; apply composer to M46
UPDATE public.exercise_templates SET
  phase = 'accessory',
  target_vector = ARRAY['upper_mobility', 'trunk_control']::text[],
  difficulty = 'medium',
  avoid_if_pain_mode = ARRAY['caution']::text[],
  progression_level = 2
WHERE id = 'M46';
