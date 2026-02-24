# Authorization & Payments Foundation

## 개요

이 문서는 `public.users` 테이블과 `public.payments` 테이블을 기반으로 한 인증·결제 기반 아키텍처를 설명합니다.

---

## 1. users 테이블 — 소스 오브 트루스 (Source of Truth)

`public.users`는 권한(authorization)과 플랜 상태의 **단일 소스**입니다.

- **id**: `auth.users.id` 참조 (1:1)
- **email**: auth에서 복사된 이메일
- **role**: `'user'` | `'admin'` — 앱 레벨 권한
- **plan_status**: `'active'` | `'inactive'` | `'cancelled'` | `'expired'` — 결제 활성 여부
- **plan_tier**: `'free'` | `'basic'` | `'standard'` | `'premium'` | `'vip'`

권한 검증 로직(AppAuthGate 등)은 이 테이블의 `plan_status`, `plan_tier`를 기준으로 합니다.

---

## 2. payments 테이블 — 멱등성 및 결제 이력

`public.payments`는 결제 이력 저장 및 멱등성 보장용입니다.

- **provider_session_id**: 결제 제공자 세션 ID (Stripe `session_id` 등) — `UNIQUE`로 중복 결제 방지
- **provider**: `'stripe'`, `'toss'` 등 — 향후 PG사 연동 확장 가능
- **user_id**: 결제 소유 사용자
- **product_id**, **amount**, **currency**, **status**: 결제 메타데이터

Webhook 또는 API에서 결제 처리 시 `provider_session_id`를 기준으로 INSERT 전 중복 여부를 확인하여 멱등성을 보장합니다.

---

## 3. 트리거 동작

`handle_new_user()` 함수가 `auth.users`에 새 사용자가 INSERT될 때 자동 실행됩니다.

1. `auth.users`에 행이 INSERT됨
2. `on_auth_user_created` 트리거가 `handle_new_user()` 호출
3. `public.users`에 `(id, email)` 삽입 (`ON CONFLICT DO NOTHING`)
4. 기존 `auth.users` 사용자는 마이그레이션 시 `INSERT ... WHERE id NOT IN (SELECT id FROM public.users)`로 backfill

---

## 4. RLS 정책 개요

| 테이블   | 작업   | 정책 설명                                   |
|----------|--------|---------------------------------------------|
| users    | SELECT | 본인 데이터만 조회 (`auth.uid() = id`)       |
| users    | UPDATE | 차단 (`using (false)`) — plan은 서버만 수정 |
| payments | SELECT | 본인 결제만 조회 (`auth.uid() = user_id`)   |

`plan_status`, `plan_tier`는 클라이언트에서 직접 수정할 수 없으며, Stripe Webhook·verify-session 등 서버 측 로직에서만 갱신됩니다.

---

## 5. admin 역할 부여 (role='admin')

`users` 테이블의 `role`은 클라이언트에서 수정할 수 없도록 RLS로 막혀 있습니다.

관리자 부여는 **Supabase Dashboard SQL Editor** 또는 **서비스 역할(service_role)** 이 필요한 API에서만 수행합니다.

```sql
-- Supabase Dashboard → SQL Editor에서 실행
UPDATE public.users
SET role = 'admin'
WHERE email = 'admin@example.com';
```

운영 환경에서는 `service_role_key`를 사용하는 서버 전용 스크립트/API로만 실행하고, 클라이언트에는 노출하지 않습니다.
