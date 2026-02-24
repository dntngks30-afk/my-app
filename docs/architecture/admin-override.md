# Admin Override: 수동 플랜 변경

## 개요

운영자가 특정 유저의 `plan_status` / `plan_tier`를 수동으로 변경할 수 있습니다.  
모든 변경은 `admin_actions` 테이블에 감사 로그로 기록됩니다.

---

## API

**엔드포인트**: `POST /api/admin/users/plan-status`  
**헤더**: `Authorization: Bearer <access_token>` 필수

**Body (JSON)**:
```json
{
  "targetUserId": "uuid",
  "targetEmail": "user@example.com",
  "plan_status": "active",
  "plan_tier": "standard",
  "reason": "결제 오류로 수동 활성화"
}
```

- `targetUserId` 또는 `targetEmail` 둘 중 하나 필수 (id 우선)
- `plan_status`: `active` | `inactive` | `cancelled` | `expired` | `trialing` | `past_due`
- `plan_tier`: 선택 (없으면 기존 값 유지)
- `reason`: 필수 (비어 있으면 400)

**응답**: `{ ok: true, targetUserId, before, after }`

---

## Admin 판별 (B: allowlist + role)

1. **ADMIN_EMAIL_ALLOWLIST**: `a@b.com,c@d.com` 형식. actor 이메일이 포함되면 admin
2. **role**: `public.users.role = 'admin'` 인 경우 admin

둘 중 하나라도 만족하면 admin으로 인정합니다.

---

## 감사 로그

`public.admin_actions` 테이블:

- `actor_user_id`, `actor_email`: 변경 실행자
- `target_user_id`, `target_email`: 대상 사용자
- `action`: `set_plan_status`
- `before`, `after`: 변경 전/후 (JSONB)
- `reason`: 변경 사유

`service_role`만 접근 가능하므로, 클라이언트(anon/user)는 읽기/쓰기 모두 불가합니다.

---

## 오류 응답

| 코드 | 의미 |
|------|------|
| 401 | 토큰 없음/유효하지 않음 |
| 403 | admin 아님 |
| 400 | reason 누락, target 미지정, plan_status 잘못됨 |
| 404 | target user 없음 |

---

## 환경 변수

```env
ADMIN_EMAIL_ALLOWLIST=admin1@example.com,admin2@example.com
```
