-- PostureLab Database Restore Script

-- 1. users table
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own data" ON public.users;
CREATE POLICY "Users can read own data" ON public.users FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own data" ON public.users;
CREATE POLICY "Users can update own data" ON public.users FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "Admins can read all data" ON public.users;
CREATE POLICY "Admins can read all data" ON public.users FOR SELECT USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));

CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, role) VALUES (NEW.id, NEW.email, 'user');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

INSERT INTO public.users (id, email, role) SELECT id, email, 'user' as role FROM auth.users WHERE id NOT IN (SELECT id FROM public.users) ON CONFLICT (id) DO NOTHING;

-- 2. requests table
CREATE TABLE IF NOT EXISTS public.requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  front_url TEXT,
  side_url TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'analyzing', 'completed')),
  diagnoses TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own requests" ON public.requests;
CREATE POLICY "Users can read own requests" ON public.requests FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own requests" ON public.requests;
CREATE POLICY "Users can insert own requests" ON public.requests FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

DROP POLICY IF EXISTS "Users can update own requests" ON public.requests;
CREATE POLICY "Users can update own requests" ON public.requests FOR UPDATE USING (auth.uid() = user_id OR user_id IS NULL);

DROP POLICY IF EXISTS "Admins can read all requests" ON public.requests;
CREATE POLICY "Admins can read all requests" ON public.requests FOR SELECT USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "Admins can update all requests" ON public.requests;
CREATE POLICY "Admins can update all requests" ON public.requests FOR UPDATE USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));

-- 3. payments table
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

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own payments" ON public.payments;
CREATE POLICY "Users can read own payments" ON public.payments FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can read all payments" ON public.payments;
CREATE POLICY "Admins can read all payments" ON public.payments FOR SELECT USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));

-- 4. assessments table
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

ALTER TABLE public.assessments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own assessments" ON public.assessments;
CREATE POLICY "Users can read own assessments" ON public.assessments FOR SELECT USING (auth.uid() = user_id OR email IN (SELECT email FROM auth.users WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Anyone can insert assessments" ON public.assessments;
CREATE POLICY "Anyone can insert assessments" ON public.assessments FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can read all assessments" ON public.assessments;
CREATE POLICY "Admins can read all assessments" ON public.assessments FOR SELECT USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));

-- 5. solutions table
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

ALTER TABLE public.solutions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own solutions" ON public.solutions;
CREATE POLICY "Users can read own solutions" ON public.solutions FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can manage all solutions" ON public.solutions;
CREATE POLICY "Admins can manage all solutions" ON public.solutions FOR ALL USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));

-- 6. Storage Buckets
INSERT INTO storage.buckets (id, name, public) VALUES ('user-photos', 'user-photos', true) ON CONFLICT (id) DO UPDATE SET public = true;
INSERT INTO storage.buckets (id, name, public) VALUES ('assessments', 'assessments', true) ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "Anyone can upload to user-photos" ON storage.objects;
CREATE POLICY "Anyone can upload to user-photos" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'user-photos');

DROP POLICY IF EXISTS "Anyone can read user-photos" ON storage.objects;
CREATE POLICY "Anyone can read user-photos" ON storage.objects FOR SELECT USING (bucket_id = 'user-photos');

DROP POLICY IF EXISTS "Anyone can upload to assessments" ON storage.objects;
CREATE POLICY "Anyone can upload to assessments" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'assessments');

DROP POLICY IF EXISTS "Anyone can read assessments" ON storage.objects;
CREATE POLICY "Anyone can read assessments" ON storage.objects FOR SELECT USING (bucket_id = 'assessments');

-- 7. Functions
CREATE OR REPLACE FUNCTION delete_expired_assessments() RETURNS void AS $$
BEGIN
  DELETE FROM public.assessments WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Success check
SELECT 'Database restored successfully' as message, (SELECT COUNT(*) FROM public.users) as users, (SELECT COUNT(*) FROM public.requests) as requests, (SELECT COUNT(*) FROM public.payments) as payments, (SELECT COUNT(*) FROM public.assessments) as assessments, (SELECT COUNT(*) FROM public.solutions) as solutions;
