-- PR-20: 28개 핵심 템플릿 v2 메타 백필
-- balance_demand, complexity. coarse values only.

-- Fallbacks / 호흡
UPDATE public.exercise_templates SET balance_demand = 'low', complexity = 'low'
WHERE id IN ('M01','M28','M02');

-- 상체 가동성
UPDATE public.exercise_templates SET balance_demand = 'low', complexity = 'low'
WHERE id IN ('M03','M04','M06','M08','M27');

UPDATE public.exercise_templates SET balance_demand = 'low', complexity = 'medium'
WHERE id IN ('M05','M07');

UPDATE public.exercise_templates SET balance_demand = 'medium', complexity = 'medium'
WHERE id IN ('M09','M25');

-- 하체 가동성
UPDATE public.exercise_templates SET balance_demand = 'low', complexity = 'low'
WHERE id IN ('M10','M11','M20');

-- 코어/하체
UPDATE public.exercise_templates SET balance_demand = 'low', complexity = 'low'
WHERE id IN ('M12');

UPDATE public.exercise_templates SET balance_demand = 'low', complexity = 'medium'
WHERE id IN ('M13','M14');

UPDATE public.exercise_templates SET balance_demand = 'medium', complexity = 'high'
WHERE id IN ('M21','M26');

-- 하체 통합/균형
UPDATE public.exercise_templates SET balance_demand = 'low', complexity = 'low'
WHERE id IN ('M15','M17','M22','M24');

UPDATE public.exercise_templates SET balance_demand = 'high', complexity = 'high'
WHERE id IN ('M16','M19','M23');

UPDATE public.exercise_templates SET balance_demand = 'high', complexity = 'low'
WHERE id IN ('M18');

-- M29~M48 (신규 홈트)
UPDATE public.exercise_templates SET balance_demand = 'low', complexity = 'medium'
WHERE id IN ('M29','M30','M31','M32','M33');

UPDATE public.exercise_templates SET balance_demand = 'low', complexity = 'low'
WHERE id IN ('M34','M41','M42','M43','M44','M45','M46','M47','M48');

UPDATE public.exercise_templates SET balance_demand = 'medium', complexity = 'medium'
WHERE id IN ('M35','M36');

UPDATE public.exercise_templates SET balance_demand = 'high', complexity = 'high'
WHERE id IN ('M37','M38','M39','M40');
