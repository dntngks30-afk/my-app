# P0: RLS Audit & Policy Fixes

## 목적

- RLS/권한/스키마 실존으로 인한 fail-silent 제거
- 민감 테이블(session_events, request_dedupe_keys): authenticated 접근 0
- 비민감 테이블: SELECT만 authenticated, write는 service_role

## 운영 DB 점검 SQL

```sql
-- 1) 테이블 존재
SELECT
  to_regclass('public.session_program_progress') AS session_program_progress,
  to_regclass('public.session_plans') AS session_plans,
  to_regclass('public.session_events') AS session_events,
  to_regclass('public.request_dedupe_keys') AS request_dedupe_keys;

-- 2) RLS 활성 여부
SELECT relname, relrowsecurity
FROM pg_class
WHERE relname IN ('session_program_progress','session_plans','session_events','request_dedupe_keys');

-- 3) 정책 목록
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname='public'
  AND tablename IN ('session_program_progress','session_plans','session_events','request_dedupe_keys')
ORDER BY tablename, cmd, policyname;

-- 4) 유니크/체크 제약
SELECT conrelid::regclass AS table_name, conname, contype, pg_get_constraintdef(oid) AS def
FROM pg_constraint
WHERE conrelid::regclass::text IN ('public.session_plans','public.session_program_progress')
ORDER BY table_name, contype, conname;

-- 5) 트리거 존재
SELECT tgname, tgrelid::regclass AS table_name
FROM pg_trigger
WHERE tgname = 'trg_session_plans_sync_progress_on_completed';
```

## 테이블별 정책 요약

| 테이블 | RLS | authenticated | service_role |
|--------|-----|---------------|--------------|
| session_program_progress | ON | SELECT (own) | bypass |
| session_plans | ON | SELECT (own) | bypass |
| session_events | ON | 없음(접근 불가) | INSERT, SELECT |
| request_dedupe_keys | ON | 없음(접근 불가) | INSERT, SELECT, UPDATE, DELETE |

## 위험 체크리스트

- [ ] session_events에 authenticated 정책 있음 → 제거
- [ ] request_dedupe_keys에 authenticated 정책 있음 → 제거
- [ ] session_plans UNIQUE(user_id, session_number) 없음 → 202603041230 선행
- [ ] trg_session_plans_sync_progress_on_completed 없음 → 202603041200 선행

## 마이그레이션 요약 (202603041430)

- session_program_progress: SELECT 정책 TO authenticated 명시
- session_plans: SELECT 정책 TO authenticated 명시
- session_events: authenticated 정책 제거(있다면)
- request_dedupe_keys: authenticated 정책 제거(있다면)

## Admin 감사 엔드포인트

```
GET /api/admin/rls-audit
Header: x-admin-audit-key: <ADMIN_AUDIT_KEY>
```

테이블 존재 여부만 반환. 상세 정책은 위 SQL로 점검.

## Rollback

```sql
-- 정책 롤백 (필요 시)
DROP POLICY IF EXISTS "session_program_progress_select_own" ON public.session_program_progress;
DROP POLICY IF EXISTS "session_plans_select_own" ON public.session_plans;
-- RLS 비활성화는 원칙적으로 하지 않음
```
