-- users 테이블 생성 및 관리자 권한 설정
-- Supabase Dashboard → SQL Editor에서 실행하세요

-- 1. users 테이블 생성
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. RLS (Row Level Security) 활성화
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- 3. 정책 생성: 사용자는 자신의 데이터만 읽을 수 있음
CREATE POLICY "Users can read own data"
  ON public.users
  FOR SELECT
  USING (auth.uid() = id);

-- 4. 정책 생성: 사용자는 자신의 데이터만 업데이트 가능
CREATE POLICY "Users can update own data"
  ON public.users
  FOR UPDATE
  USING (auth.uid() = id);

-- 5. 정책 생성: 관리자는 모든 데이터를 읽을 수 있음
CREATE POLICY "Admins can read all data"
  ON public.users
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- 6. 트리거 함수: 새 사용자 가입 시 자동으로 users 테이블에 추가
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, role)
  VALUES (NEW.id, NEW.email, 'user');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. 트리거 생성: auth.users에 새 사용자 추가 시 자동 실행
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 8. 기존 auth.users의 사용자를 public.users로 마이그레이션
INSERT INTO public.users (id, email, role)
SELECT 
  id, 
  email, 
  'user' as role
FROM auth.users
WHERE id NOT IN (SELECT id FROM public.users)
ON CONFLICT (id) DO NOTHING;

-- 9. 본인 계정을 admin으로 설정 (이메일을 본인 것으로 변경하세요!)
-- UPDATE public.users 
-- SET role = 'admin' 
-- WHERE email = '여기에_본인_이메일@example.com';

-- 완료 메시지
SELECT 
  'users 테이블이 생성되었습니다!' as message,
  COUNT(*) as total_users
FROM public.users;
