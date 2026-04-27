# MOVE RE Auth Contract (SSOT)

**목적**: 현재 저장소의 인증 패턴을 코드 기반으로 문서화. Auth 리팩토링 전 반드시 참조.

**범위**: API 라우트, 클라이언트 진입점, SSOT 헬퍼. Auth 동작 변경 시 이 문서와 일치 여부 확인 필수.

---

## 1. Current Auth Models

| 모델 | 설명 | 사용처 |
|------|------|--------|
| **Bearer (getCurrentUserId)** | `Authorization: Bearer <access_token>` → userId 추출. requestAuthCache로 요청당 1회 검증. | 대부분 API 라우트 |
| **Bearer + Active Plan (requireActivePlan)** | Bearer 검증 + `users.plan_status === 'active'` 확인. 401/403 반환. | 유료 전용 API |
| **Bearer + Admin (requireAdmin)** | Bearer 검증 + `users.role === 'admin'` 확인. | Admin API |
| **Client Session (getSessionSafe)** | Supabase `auth.getSession()` — 클라이언트 세션 확인. | AppAuthGate, 페이지 진입 |
| **Session → Bearer** | `getSessionSafe()` → `session.access_token` → API 호출 시 Bearer 헤더. | 앱 내 API 호출 |
| **CRON_SECRET** | `Authorization: Bearer ${CRON_SECRET}` — Vercel Cron 전용. | cron/daily-workout-notification |
| **x-admin-audit-key** | `ADMIN_AUDIT_KEY` env와 비교. | admin/rls-audit |

---

## 2. SSOT Helpers

| 헬퍼 | 파일 | 역할 |
|------|------|------|
| `getCurrentUserId(req)` | `src/lib/auth/getCurrentUserId.ts` | Bearer 토큰 → userId. getCachedUserId(requestAuthCache) 사용. |
| `requireActivePlan(req)` | `src/lib/auth/requireActivePlan.ts` | Bearer + plan_status='active'. 401/403 또는 `{ userId }`. |
| `requireAdmin(req)` | `src/lib/auth/requireAdmin.ts` | Bearer + admin role. 401/403 또는 `{ user, supabase }`. |
| `requireDeepAuth(req)` | `src/lib/deep-test/auth.ts` | requireActivePlan 래퍼. Deep Test 전용. |
| `getSessionSafe()` | `src/lib/supabase.ts` | 클라이언트 Supabase session. AbortError 재시도. |
| `getBearerToken(req)` | `src/lib/auth/requestAuthCache.ts` | Authorization 헤더에서 토큰 추출 (캐시). |
| `getCachedUserId(req, supabase)` | `src/lib/auth/requestAuthCache.ts` | 요청당 1회 auth 검증. getClaims 우선, fallback getUser. |

---

## 3. Route & Flow Inventory

### 3.1 Bearer (getCurrentUserId) — 공유 헬퍼 사용

| Path | Caller | Active Plan | 비고 |
|------|--------|-------------|------|
| `/api/bootstrap` | AppAuthGate → getBootstrap | no | 홈 초기 진입 |
| `/api/home/bootstrap` | getCachedBootstrap | no | bootstrap-lite |
| `/api/session/create` | SessionPanel, RoutineHub | no | Path B 세션 생성 |
| `/api/session/complete` | SessionPlayer | no | 세션 완료 |
| `/api/session/active` | active-cache, client | no | |
| `/api/session/active-lite` | active-cache | no | |
| `/api/session/profile` | client | no | |
| `/api/session/plan` | client | no | |
| `/api/session/plan-detail` | client | no | |
| `/api/session/plan-summary` | client | no | |
| `/api/session/history` | client | no | |
| `/api/session/progress-report` | ProgressReportCard | no | |
| `/api/daily-condition/today` | client | no | |
| `/api/daily-condition/upsert` | client | no | |
| `/api/report/weekly` | client | no | |
| `/api/report/day7` | client | no | |
| `/api/routine-engine/activate` | client | no | |
| `/api/routine-engine/status` | client | no | |
| `/api/routine-engine/start-day` | client | no | |
| `/api/routine-engine/complete-session` | client | no | |
| `/api/workout-routine/get` | client | no | |
| `/api/workout-routine/start` | client | no | |
| `/api/workout-routine/complete-day` | client | no | |
| `/api/routine-plan/get` | client | no | |
| `/api/routine-plan/generate` | client | no | |
| `/api/routine-plan/revisions` | client | no | |
| `/api/exercise-templates` | client | no | |
| `/api/exercise-templates/[id]` | client | no | |
| `/api/exercise-templates/filter` | routine-engine | no | |
| `/api/movement-test/get-latest-by-user` | StripeSuccessClient | no | |
| `/api/movement-test/save-result` | client | no | |
| `/api/push-notifications/subscribe` | client | no | body.userId 신뢰 안 함 |
| `/api/my-report` | client | no | |
| `/api/coach-comments/[id]` | client | no | |
| `/api/coach-comments/generate` | client | no | body.userId 신뢰 안 함 |
| `/api/coach-comments/user/[userId]` | client | no | params.userId 신뢰 안 함 |
| `/api/pilot/redeem` | session-preparing → `redeemPilotAccessClient` | no | Bearer + `getUser`; `redeem_pilot_access` RPC로 `plan_status` 활성화 (PR-PILOT-ENTITLEMENT-02) |

### 3.2 Bearer + Active Plan (requireActivePlan)

| Path | Caller | 비고 |
|------|--------|------|
| `/api/media/sign` | ExercisePlayer, media-cache | 영상 signed URL — 핵심 리스크 |
| `/api/exercise-template/media` | client | |
| `/api/routine/list` | RoutineHub | |
| `/api/routine-plan/ensure` | client | |
| `/api/home/dashboard` | client | |
| `/api/workout-routine/create` | client | |
| `/api/movement-test/retest` | client | |
| `/api/deep-test/*` (via requireDeepAuth) | DeepAnalysisClient | get-or-create, get-latest, save, finalize |

### 3.3 Bearer + Admin (requireAdmin)

| Path | Caller | 비고 |
|------|--------|------|
| `/api/admin/templates` | admin pages | |
| `/api/admin/templates/[id]` | admin pages | |
| `/api/admin/templates/[id]/toggle-status` | admin pages | |
| `/api/admin/templates/validate` | admin pages | |
| `/api/admin/backfill/deep-routine-day1` | admin | |
| `/api/admin/backfill/routine-plans` | admin | |

### 3.4 Inline Auth (의도적 유지 — 변경 금지)

| Path | Auth 방식 | 비고 |
|------|------------|------|
| `/api/payments` | Bearer + getUser 직접 | 결제 흐름 — 변경 금지 |
| `/api/admin/check` | Bearer + getUser | Admin 전용 |
| `/api/admin/users/plan-status` | Bearer + getUser | Admin 전용 |
| `/api/stripe/checkout` | Bearer + getUser | 결제 — 변경 금지 |
| `/api/stripe/verify-session` | Bearer + getUser | 결제 — 변경 금지 |

### 3.5 Special / Non-User Auth

| Path | Auth | 비고 |
|------|------|------|
| `/api/cron/daily-workout-notification` | `Bearer ${CRON_SECRET}` | Vercel Cron |
| `/api/admin/rls-audit` | `x-admin-audit-key` | ADMIN_AUDIT_KEY env |
| `/api/stripe/webhook` | Stripe signature | Webhook 전용 |

### 3.6 Intentional Public / Anonymous

| Path | Auth | 비고 |
|------|------|------|
| `/api/movement-test/get-result/[shareId]` | 없음 | 공유 링크 — share_id로 조회 |
| `/api/movement-test/feedback` | 없음 | 익명 피드백 설문 |
| `/api/plans/get-by-tier` | 없음 | 공개 플랜 정보 |

---

## 4. Client Entry Points (Session → Bearer)

| 진입점 | 패턴 | 비고 |
|--------|------|------|
| **AppAuthGate** | getSessionSafe → getCachedBootstrap(session.access_token) | /app/* 래퍼. plan_status 확인. |
| **SessionPanelV2** | getSessionSafe → session.user.id | |
| **RoutineHubClient** | getSessionSafe → Bearer | |
| **SessionRoutinePanel** | getSessionSafe → Bearer | |
| **ExercisePlayerModal** | getSessionSafe → Bearer | |
| **ProfileTabContent** | getSessionSafe | |
| **StatsTabContent** | getSessionSafe | |
| **ProgressReportCard** | getSessionSafe → access_token | |
| **PaymentsClient** | getSessionSafe → Bearer | |
| **PaymentsGate** | getSessionSafe | |
| **my-report** | getSessionSafe → Bearer | |
| **my-routine** | getSessionSafe → Bearer | |
| **admin pages** | getSessionSafe → Bearer | |
| **DeepAnalysisClient** | getSessionSafe | |
| **PayModal** | session.user.id, Bearer | |
| **StripeSuccessClient** | getSessionSafe → Bearer | |
| **PaymentSuccessClient** | getSessionSafe → Bearer | |
| **supabaseSync** | getSessionSafe | movement-test |
| **tabDataCache** | getSessionSafe | |
| **useRoutineStatus** | getSessionSafe → Bearer | |
| **media-cache** | Bearer (token from caller) | |

**핵심**: 클라이언트는 `getSessionSafe()`로 세션 확보 후, API 호출 시 `Authorization: Bearer ${session.access_token}` 사용. 세션 기반 UI + Bearer 기반 API.

---

## 5. Transitional / Problematic Areas

| 영역 | 이슈 | 위험도 |
|------|------|--------|
| **payments / stripe** | getUser 직접 호출. 결제 흐름 — 변경 시 Stripe 연동 검증 필요. | 변경 금지 |
| **admin/check, admin/users/plan-status** | Bearer + getUser. Admin 전용 — requireAdmin 전환 시 별도 검토. | 낮음 |
| **Session vs Bearer 혼재** | 클라이언트는 session, API는 Bearer. 동일 토큰이지만 문서화 부족 시 혼란. | 낮음 |

**완료된 표준화 (2025-03)**: report/day7, movement-test/*, routine-plan/*, exercise-templates/*, push-notifications/subscribe, my-report, coach-comments/* → 공유 getCurrentUserId 사용.

---

## 6. Safe Editing Rules

1. **getCurrentUserId / requireActivePlan 사용 중인 라우트**: 동작 변경 금지. 헬퍼 내부만 수정 시 전체 영향 검토.
2. **media/sign, session/create, session/complete**: 핵심 리스크. Auth 변경 시 PWA/플레이어/세션 흐름 검증.
3. **Stripe / payments**: auth 로직 변경 금지.
4. **Admin API**: requireAdmin 사용. Bearer + admin role 유지.
5. **새 API 추가 시**: Bearer 필요하면 `getCurrentUserId` 또는 `requireActivePlan` 사용. 로컬 auth 구현 금지.

---

## 7. Recommended Migration Order (Future PRs)

1. **payments / stripe**: 결제 흐름 — 변경 금지. 필요 시 별도 결제 인프라 PR.
2. **admin/check, admin/users/plan-status**: requireAdmin 전환 검토 (선택).
3. **문서 동기화**: 이 문서를 라우트 추가/변경 시마다 갱신.

---

## 8. Verification Notes

- **검색 근거** (2025-03 리스캔 기준):
  - `getCurrentUserId`: 35+ API 라우트 (표준화 완료)
  - `requireActivePlan`: 7 라우트 (media/sign, routine/list, routine-plan/ensure, home/dashboard, workout-routine/create, movement-test/retest, deep-test/*)
  - `requireAdmin`: 6 admin 라우트
  - Inline getUser (의도적 유지): payments, stripe/checkout, stripe/verify-session, admin/check, admin/users/plan-status
  - `getSessionSafe`: 20+ 클라이언트 컴포넌트/페이지
- **호출 흐름**: AppAuthGate → getSessionSafe → getCachedBootstrap(token) → /api/home/bootstrap (Bearer)

---

## 9. Do Not Change Without Approval

- `src/lib/auth/getCurrentUserId.ts` — 모든 Bearer API의 SSOT
- `src/lib/auth/requireActivePlan.ts` — 유료 전용 API SSOT
- `src/lib/auth/requestAuthCache.ts` — 요청당 1회 검증, 캐시
- `src/app/app/_components/AppAuthGate.tsx` — 앱 진입 게이트
- `src/app/api/media/sign/route.ts` — 영상 서명
- `src/app/api/session/create/route.ts` — 세션 생성
- `src/app/api/stripe/*` — 결제
- `src/app/api/payments/route.ts` — 결제

---

## 10. Prioritized Next PRs (Auth Residue Rescan 2025-03)

| 우선순위 | PR 대상 | 위험도 | 비고 |
|----------|----------|--------|------|
| 1 | — | — | Inline auth 표준화 완료. 추가 low-risk residue 없음. |
| 2 | (선택) admin/check, admin/users/plan-status | 낮음 | requireAdmin 전환 시 별도 검토 |
| 3 | payments/stripe | — | 변경 금지. 결제 흐름 별도 인프라 PR 필요 시 |
