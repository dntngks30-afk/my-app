-- PR1-FEEDBACK SIMPLIFY: 4단 흐름용 컬럼 추가
-- 실행: Supabase SQL Editor

ALTER TABLE movement_test_feedback ADD COLUMN IF NOT EXISTS accuracy_feel text;
ALTER TABLE movement_test_feedback ADD COLUMN IF NOT EXISTS wants_precision text;
ALTER TABLE movement_test_feedback ADD COLUMN IF NOT EXISTS precision_feature text;
ALTER TABLE movement_test_feedback ADD COLUMN IF NOT EXISTS precision_feature_other text;
