-- PR-ALG-04: 28개 핵심 템플릿 메타 최소 패치
-- phase, target_vector, difficulty, avoid_if_pain_mode, progression_level
-- UPDATE 전용, INSERT/DELETE 없음

-- Fallbacks: 호흡/리셋류
UPDATE public.exercise_templates SET
  phase = 'prep',
  target_vector = ARRAY['trunk_control','deconditioned'],
  difficulty = 'low',
  avoid_if_pain_mode = '{}',
  progression_level = 1
WHERE id IN ('M01','M28','M02');

-- 상체 가동성: prep/accessory/main
UPDATE public.exercise_templates SET
  phase = 'prep',
  target_vector = ARRAY['upper_mobility'],
  difficulty = 'low',
  avoid_if_pain_mode = '{}',
  progression_level = 1
WHERE id IN ('M03','M04','M27');

UPDATE public.exercise_templates SET
  phase = 'main',
  target_vector = ARRAY['upper_mobility'],
  difficulty = 'medium',
  avoid_if_pain_mode = '{}',
  progression_level = 2
WHERE id IN ('M05','M07','M08');

UPDATE public.exercise_templates SET
  phase = 'accessory',
  target_vector = ARRAY['upper_mobility'],
  difficulty = 'low',
  avoid_if_pain_mode = '{}',
  progression_level = 1
WHERE id IN ('M06');

UPDATE public.exercise_templates SET
  phase = 'main',
  target_vector = ARRAY['upper_mobility','trunk_control'],
  difficulty = 'medium',
  avoid_if_pain_mode = ARRAY['caution'],
  progression_level = 2
WHERE id IN ('M09','M25');

-- 하체 가동성
UPDATE public.exercise_templates SET
  phase = 'accessory',
  target_vector = ARRAY['lower_mobility'],
  difficulty = 'low',
  avoid_if_pain_mode = '{}',
  progression_level = 1
WHERE id IN ('M10','M11');

UPDATE public.exercise_templates SET
  phase = 'main',
  target_vector = ARRAY['lower_mobility','trunk_control'],
  difficulty = 'medium',
  avoid_if_pain_mode = '{}',
  progression_level = 2
WHERE id IN ('M20');

-- 코어/하체 안정
UPDATE public.exercise_templates SET
  phase = 'main',
  target_vector = ARRAY['trunk_control','lower_stability'],
  difficulty = 'low',
  avoid_if_pain_mode = '{}',
  progression_level = 1
WHERE id IN ('M12');

UPDATE public.exercise_templates SET
  phase = 'main',
  target_vector = ARRAY['trunk_control'],
  difficulty = 'medium',
  avoid_if_pain_mode = '{}',
  progression_level = 2
WHERE id IN ('M13','M14');

UPDATE public.exercise_templates SET
  phase = 'main',
  target_vector = ARRAY['trunk_control'],
  difficulty = 'high',
  avoid_if_pain_mode = ARRAY['protected'],
  progression_level = 3
WHERE id IN ('M21','M26');

-- 하체 통합/균형
UPDATE public.exercise_templates SET
  phase = 'main',
  target_vector = ARRAY['lower_stability'],
  difficulty = 'medium',
  avoid_if_pain_mode = '{}',
  progression_level = 2
WHERE id IN ('M15','M17');

UPDATE public.exercise_templates SET
  phase = 'main',
  target_vector = ARRAY['lower_stability','lower_mobility'],
  difficulty = 'high',
  avoid_if_pain_mode = ARRAY['protected'],
  progression_level = 3
WHERE id IN ('M16');

UPDATE public.exercise_templates SET
  phase = 'main',
  target_vector = ARRAY['lower_stability'],
  difficulty = 'high',
  avoid_if_pain_mode = ARRAY['caution'],
  progression_level = 3
WHERE id IN ('M19');

UPDATE public.exercise_templates SET
  phase = 'main',
  target_vector = ARRAY['lower_stability','asymmetry'],
  difficulty = 'low',
  avoid_if_pain_mode = '{}',
  progression_level = 1
WHERE id IN ('M18','M22');

UPDATE public.exercise_templates SET
  phase = 'main',
  target_vector = ARRAY['lower_stability','asymmetry'],
  difficulty = 'high',
  avoid_if_pain_mode = ARRAY['protected'],
  progression_level = 3
WHERE id IN ('M23');

-- 발목
UPDATE public.exercise_templates SET
  phase = 'accessory',
  target_vector = ARRAY['lower_mobility'],
  difficulty = 'low',
  avoid_if_pain_mode = '{}',
  progression_level = 1
WHERE id IN ('M24');
