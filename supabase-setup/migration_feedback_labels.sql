-- PR1-REVISION: codes + labels 컬럼 추가 (기존 테이블 유지, 회귀 방지)
-- 실행: Supabase SQL Editor

ALTER TABLE movement_test_feedback ADD COLUMN IF NOT EXISTS reasons_codes text[] DEFAULT '{}';
ALTER TABLE movement_test_feedback ADD COLUMN IF NOT EXISTS reasons_labels text[] DEFAULT '{}';
ALTER TABLE movement_test_feedback ADD COLUMN IF NOT EXISTS paid_features_codes text[] DEFAULT '{}';
ALTER TABLE movement_test_feedback ADD COLUMN IF NOT EXISTS paid_features_labels text[] DEFAULT '{}';
ALTER TABLE movement_test_feedback ADD COLUMN IF NOT EXISTS blockers_codes text[] DEFAULT '{}';
ALTER TABLE movement_test_feedback ADD COLUMN IF NOT EXISTS blockers_labels text[] DEFAULT '{}';
ALTER TABLE movement_test_feedback ADD COLUMN IF NOT EXISTS payment_preference_code text;
ALTER TABLE movement_test_feedback ADD COLUMN IF NOT EXISTS payment_preference_label text;
ALTER TABLE movement_test_feedback ADD COLUMN IF NOT EXISTS price_range_code text;
ALTER TABLE movement_test_feedback ADD COLUMN IF NOT EXISTS price_range_label text;
ALTER TABLE movement_test_feedback ADD COLUMN IF NOT EXISTS purchase_trigger_code text;
ALTER TABLE movement_test_feedback ADD COLUMN IF NOT EXISTS purchase_trigger_label text;
