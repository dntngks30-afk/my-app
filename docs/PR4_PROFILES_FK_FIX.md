# PR4: profiles auth 가드 + FK + orphan 정리

## 코드 감사 결과

- `getServerSupabaseAdmin()` / `getServerSupabase()`: auth UI/complete 흐름에 없음 ✓
- profiles/users service role upsert API: 없음 ✓
- signup/complete: `user.id`만 사용, `getUser()` 후 upsert ✓

## 변경 파일 리스트

- `supabase-setup/fix-profiles-fk-and-orphans.sql` - 신규 (orphan 삭제 + FK + email 컬럼)
- `src/app/signup/complete/page.tsx` - 가드 보강, profiles upsert에 `email` 포함

## DB 적용 방법

Supabase Dashboard → SQL Editor에서 실행:

```
supabase-setup/fix-profiles-fk-and-orphans.sql
```

## 검증 시나리오

### (1) /signup에서 새 이메일로 링크 발송
- 이메일 입력 후 회원가입 → "메일 확인" UI 표시

### (2) 링크 클릭 → /signup/complete 진입 → 이메일 disabled 고정 표시
- 이메일 링크 클릭 → /signup/complete 도달 → 이메일 필드 disabled로 표시

### (3) 비번+생년월일 제출 → profiles row 생성/업데이트
- 비밀번호 6자 이상 + 생년월일 입력 후 제출 → "/" 리다이렉트

### (4) Supabase SQL Editor 확인

```sql
SELECT count(*) FROM auth.users;
SELECT count(*) FROM public.profiles;

SELECT p.id, u.email, p.birthdate, p.email AS profile_email
FROM public.profiles p
JOIN auth.users u ON u.id = p.id
ORDER BY u.created_at DESC
LIMIT 10;
```

auth.users와 profiles 건수가 일치하고, profiles의 모든 row가 auth.users와 JOIN되어야 함 (orphan 0).

## 완료 조건(AC)

- ✓ auth user 없이 profiles insert/upsert 불가 (FK로 DB 차단)
- ✓ /signup/complete는 user 없으면 폼 미노출, 즉시 /signup 리다이렉트
- ✓ orphan profiles 정리 마이그레이션 포함
