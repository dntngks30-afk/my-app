-- PostureLab Database Complete Restore Script
-- 최종 검증 완료 버전

-- ====================================
-- STEP 1: 테이블 생성
-- ====================================

-- users table
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- payments table
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  request_id UUID REFERENCES public.requests(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  order_id TEXT UNIQUE NOT NULL,
  payment_key TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- assessments table
CREATE TABLE IF NOT EXISTS public.assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  email TEXT NOT NULL,
  name TEXT,
  survey_responses JSONB NOT NULL,
  analysis_result JSONB NOT NULL,
  pdf_url TEXT,
  status TEXT DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '24 hours')
);

CREATE INDEX IF NOT EXISTS idx_assessments_email ON public.assessments(email);
CREATE INDEX IF NOT EXISTS idx_assessments_user_id ON public.assessments(user_id);
CREATE INDEX IF NOT EXISTS idx_assessments_created_at ON public.assessments(created_at);

-- solutions table
CREATE TABLE IF NOT EXISTS public.solutions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  request_id UUID REFERENCES public.requests(id) ON DELETE CASCADE,
  diagnoses TEXT[],
  inhibit_content TEXT,
  lengthen_content TEXT,
  activate_content TEXT,
  integrate_content TEXT,
  expert_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ====================================
-- STEP 2: Functions & Triggers
-- ====================================

-- Auto-delete expired assessments
CREATE OR REPLACE FUNCTION delete_expired_assessments() RETURNS void AS $$
BEGIN
  DELETE FROM public.assessments WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Auto-create user on signup
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, role) VALUES (NEW.id, NEW.email, 'user');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created 
AFTER INSERT ON auth.users 
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Sync existing users
INSERT INTO public.users (id, email, role) 
SELECT id, email, 'user' as role 
FROM auth.users 
WHERE id NOT IN (SELECT id FROM public.users) 
ON CONFLICT (id) DO NOTHING;

-- ====================================
-- STEP 3: RLS 정책
-- ====================================

-- Enable RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.solutions ENABLE ROW LEVEL SECURITY;

-- users policies
DROP POLICY IF EXISTS "users_select_own" ON public.users;
CREATE POLICY "users_select_own" 
ON public.users FOR SELECT 
USING (id = auth.uid());

DROP POLICY IF EXISTS "users_update_own" ON public.users;
CREATE POLICY "users_update_own" 
ON public.users FOR UPDATE 
USING (id = auth.uid());

-- requests policies (user_id는 TEXT 타입이므로 캐스팅 필요!)
DROP POLICY IF EXISTS "requests_select_own" ON public.requests;
CREATE POLICY "requests_select_own" 
ON public.requests FOR SELECT 
USING (user_id = auth.uid()::text OR user_id IS NULL);

DROP POLICY IF EXISTS "requests_insert_own" ON public.requests;
CREATE POLICY "requests_insert_own" 
ON public.requests FOR INSERT 
WITH CHECK (user_id = auth.uid()::text OR user_id IS NULL);

DROP POLICY IF EXISTS "requests_update_own" ON public.requests;
CREATE POLICY "requests_update_own" 
ON public.requests FOR UPDATE 
USING (user_id = auth.uid()::text OR user_id IS NULL);

-- payments policies
DROP POLICY IF EXISTS "payments_select_own" ON public.payments;
CREATE POLICY "payments_select_own" 
ON public.payments FOR SELECT 
USING (user_id = auth.uid());

-- assessments policies
DROP POLICY IF EXISTS "assessments_select_own" ON public.assessments;
CREATE POLICY "assessments_select_own" 
ON public.assessments FOR SELECT 
USING (user_id = auth.uid() OR user_id IS NULL);

DROP POLICY IF EXISTS "assessments_insert_anyone" ON public.assessments;
CREATE POLICY "assessments_insert_anyone" 
ON public.assessments FOR INSERT 
WITH CHECK (true);

-- solutions policies
DROP POLICY IF EXISTS "solutions_select_own" ON public.solutions;
CREATE POLICY "solutions_select_own" 
ON public.solutions FOR SELECT 
USING (user_id = auth.uid());

-- ====================================
-- STEP 4: Storage 정책 (Bucket은 UI에서 생성)
-- ====================================

-- user-photos bucket policies
DROP POLICY IF EXISTS "Anyone can upload to user-photos" ON storage.objects;
CREATE POLICY "Anyone can upload to user-photos" 
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'user-photos');

DROP POLICY IF EXISTS "Anyone can read user-photos" ON storage.objects;
CREATE POLICY "Anyone can read user-photos" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'user-photos');

-- assessments bucket policies
DROP POLICY IF EXISTS "Anyone can upload to assessments" ON storage.objects;
CREATE POLICY "Anyone can upload to assessments" 
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'assessments');

DROP POLICY IF EXISTS "Anyone can read assessments" ON storage.objects;
CREATE POLICY "Anyone can read assessments" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'assessments');

-- ====================================
-- STEP 5: 관리자 설정
-- ====================================

UPDATE public.users 
SET role = 'admin' 
WHERE email = 'dntngks30@gmail.com';

-- ====================================
-- 완료 확인
-- ====================================

SELECT 
  'Database fully restored!' as message,
  (SELECT COUNT(*) FROM public.users) as users,
  (SELECT COUNT(*) FROM public.requests) as requests,
  (SELECT COUNT(*) FROM public.payments) as payments,
  (SELECT COUNT(*) FROM public.assessments) as assessments,
  (SELECT COUNT(*) FROM public.solutions) as solutions;
