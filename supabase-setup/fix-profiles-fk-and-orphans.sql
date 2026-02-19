-- PR4: profiles orphan 정리 + FK 강제 + email 컬럼
-- Supabase Dashboard → SQL Editor에서 실행하세요

-- 1. orphan profiles 제거 (auth.users에 없는 id)
DELETE FROM public.profiles p
WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p.id);

-- 2. 기존 FK 제거 후 명시적 FK 추가 (DB 레벨 차단 강화)
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_id_fk;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_id_fk
  FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- 3. email 컬럼 추가 (디버깅/관리 편의)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;
