-- ================================================
-- exercise_templates 메타 패치 (N-S / Upper-limb 편향 완화)
-- UPDATE 전용, INSERT/DELETE 없음. 3개 템플릿 수정.
-- 목적: NECK-SHOULDER level1+shoulder_overhead, UPPER-LIMB wrist_load 시 후보 풀 확대
--
-- Before/After:
-- | id  | before (level, focus_tags, contraindications)           | after
-- | M05 | 2, [thoracic_mobility,shoulder_mobility], {}            | 1, [thoracic_mobility,shoulder_mobility,shoulder_stability], {}
-- | M27 | 1, [thoracic_mobility,shoulder_mobility], {}           | 1, [thoracic_mobility,shoulder_mobility,upper_trap_release], {}
-- | M08 | 2, [upper_back_activation,thoracic_mobility], [shoulder_anterior_pain] | 1, (unchanged), (unchanged)
-- ================================================

-- A+F) M05: level 2→1, focus_tags에 shoulder_stability 추가
--    contraindications 없음(안전) / thoracic+shoulder → N-S, shoulder_stability → UPPER-LIMB 매칭
UPDATE public.exercise_templates
SET level = 1, focus_tags = ARRAY['thoracic_mobility','shoulder_mobility','shoulder_stability']
WHERE id = 'M05';

-- B) M27: focus_tags에 upper_trap_release 추가 (N-S 매칭 강화, M03/M27 단조 완화)
UPDATE public.exercise_templates
SET focus_tags = ARRAY['thoracic_mobility','shoulder_mobility','upper_trap_release']
WHERE id = 'M27';

-- C) M08: level 2→1 (shoulder_anterior_pain 유지, overhead와 별개 제약)
--    upper_back_activation, thoracic_mobility → level1 상체 후보 확대
UPDATE public.exercise_templates
SET level = 1
WHERE id = 'M08';
