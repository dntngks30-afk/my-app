# PR3: Signup Step2 완료

## DB 적용 방법 (간단)

Supabase Dashboard → SQL Editor에서 아래 파일 내용을 복사해 실행:

```
supabase-setup/create-profiles-table.sql
```

또는 직접 실행:

```sql
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  birthdate DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
-- (나머지 RLS 정책은 create-profiles-table.sql 참고)
```

## 변경 사항

1. **profiles 테이블 + RLS** - `supabase-setup/create-profiles-table.sql` 추가
2. **/signup/complete submit** - updateUser(password) + profiles upsert(birthdate) → 성공 시 "/" 리다이렉트
3. **가드/재진입** - 세션 없으면 /signup, profiles에 birthdate 있으면 즉시 / 이동
