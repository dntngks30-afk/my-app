-- movement_test_feedback: 테스트 평가 설문 저장 (PR1)
-- 실행: Supabase SQL Editor 또는 migrations

CREATE TABLE IF NOT EXISTS movement_test_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  movement_test_version text NOT NULL,
  result_main_animal text,
  result_type text,
  axis_scores jsonb,
  accuracy_rating int NOT NULL,
  reasons text[] DEFAULT '{}',
  reasons_other text,
  paid_features_top2 text[] DEFAULT '{}',
  paid_features_other text,
  payment_preference text,
  payment_other text,
  price_range text,
  price_other text,
  blockers text[] DEFAULT '{}',
  blockers_other text,
  email text,
  wants_beta boolean DEFAULT false,
  user_agent text,
  referrer text
);

-- RLS: anon 접근 차단. 서버 API는 service_role로 insert (RLS bypass)
ALTER TABLE movement_test_feedback ENABLE ROW LEVEL SECURITY;
-- (permissive policy 없음 → anon 권한 없음, service_role은 RLS bypass)
