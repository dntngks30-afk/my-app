# Next.js + Supabase SaaS 안정화 — PR 단위 작업 계획

**목표**: Next.js + Supabase 기반 SaaS 안정화  
**제약**: Service role 키는 클라이언트 번들에 절대 포함 금지. 각 PR마다 테스트/검증 절차 및 문서 업데이트 포함.

---

## PR 1: Movement scoring 단일 소스화 (중복 제거, import 경로 통일)

### 브랜치명
`feat/movement-scoring-single-source`

### 변경/추가/삭제 파일

| 구분 | 경로 |
|------|------|
| **단일 소스** | `src/lib/movement-test/scoring.ts` (신규 또는 기존 `scoring-logic.ts` 통합) |
| **수정** | `src/features/movement-test/utils/scoring.ts` → `@/lib/movement-test/scoring` re-export만 하거나 삭제 후 참조 변경 |
| **수정** | `src/app/movement-test/result/page.tsx` — import를 `@/lib/movement-test/scoring` 등 단일 경로로 통일 |
| **수정** | `src/app/movement-test/shared/[shareId]/page.tsx` — `../../data/type-descriptions` → `@/features/movement-test/data/results/type-descriptions` 또는 `@/lib/movement-test` |
| **삭제** | `src/app/movement-test/data/scoring-logic.ts` (로직을 lib로 이전 후) |
| **삭제** | `src/app/movement-test/data/adjustConfidenceWithImbalance.ts` (이미 features에 동일 파일 있음) |
| **유지/정리** | `src/lib/movement-test/scoring-logic.ts` — `scoring.ts`로 통합하거나 메인 진입점으로 사용. `typeToCode`/`codeToType` 등은 app 쪽 scoring-logic에만 있으므로 lib로 이전 후 export |
| **수정** | `src/features/movement-test/data/results/adjustConfidenceWithImbalance.ts` — 유일 소스로 두고, 필요 시 `@/lib/movement-test`에서 re-export |

### 작업 단계 (순서)

1. **단일 진입점 결정**: `src/lib/movement-test/scoring.ts`를 단일 소스로 정의.  
   - `app/movement-test/data/scoring-logic.ts`의 `calculateTestResult`, `typeToCode`, `codeToType`, `computeConfidence`, `confidenceToMessage` 등을 lib로 이전.  
   - `features/movement-test/utils/scoring.ts`와 `lib/movement-test/scoring-logic.ts`의 중복 제거(한쪽 구현만 유지).
2. **adjustConfidence**: `adjustConfidenceWithImbalance`는 features에만 두고, result 페이지는 기존처럼 features에서 import. (또는 lib에서 re-export해도 됨.)
3. **result/page.tsx**: `calculateTestResult`를 `@/lib/movement-test/scoring`에서 import. `mainTypeCode` 계산은 `typeToCode(result.mainType)` 사용.
4. **shared/[shareId]/page.tsx**: `getSubTypeContent`를 features 또는 lib 단일 경로로 변경.
5. **삭제**: `src/app/movement-test/data/scoring-logic.ts`, `src/app/movement-test/data/adjustConfidenceWithImbalance.ts`.
6. **features re-export(선택)**: `src/features/movement-test/utils/scoring.ts`가 있으면 `export { calculateTestResult } from '@/lib/movement-test/scoring';`만 두어 기존 import 호환 유지.
7. **문서**: `docs/MOVEMENT_TYPE_TEST_TASKS.md` 또는 `WORK_LOG.md`에 “Scoring 단일 소스: `@/lib/movement-test/scoring`” 명시.

### Acceptance checklist

- [ ] `calculateTestResult`를 import하는 코드는 모두 `@/lib/movement-test/scoring`(또는 그 re-export)만 사용한다.
- [ ] `app/movement-test/data/scoring-logic.ts` 및 `app/movement-test/data/adjustConfidenceWithImbalance.ts` 삭제 후 `npm run build` 성공.
- [ ] `/movement-test/survey` 진행 후 `/movement-test/result`에서 결과·신뢰도·불균형 보정이 기존과 동일하게 표시된다.
- [ ] `/movement-test/shared/[shareId]`에서 공유 결과 렌더 정상.
- [ ] 문서에 scoring 단일 소스 경로가 반영되어 있다.

---

## PR 2: movement_test_attempts 스키마 + API (attempt 기반 save/retest/compare, scoring_version 저장)

### 브랜치명
`feat/movement-test-attempts-schema-api`

### 변경/추가/삭제 파일

| 구분 | 경로 |
|------|------|
| **추가** | `supabase-setup/create-movement-test-attempts-table.sql` — `movement_test_attempts` 테이블, RLS, 인덱스 |
| **추가** | `movement_test_results`에 `attempt_id` FK 또는 attempts가 results를 1:1 참조하도록 설계 (또는 attempts만 저장하고 결과는 JSONB로) |
| **수정** | `src/app/api/movement-test/save-result/route.ts` — `user_id`는 서버 인증으로 확정, `movement_test_attempts` insert + 필요 시 `movement_test_results` 연동, `scoring_version` 저장 |
| **수정** | `src/app/api/movement-test/get-latest-by-user/route.ts` — attempts 기준 최신 조회, 필요 시 result join |
| **수정** | `src/app/api/movement-test/retest/route.ts` — attempt 기반 비교, 기존/신규 attempt_id 사용 |
| **수정** | `src/app/movement-test/retest-comparison/` 페이지 — API가 attempt 기반으로 반환하므로 클라이언트는 기존 스펙 유지 |
| **문서** | `docs/MOVEMENT_TEST_ATTEMPTS.md` 또는 기존 movement-test 문서에 스키마·API 변경 내역 추가 |

### 작업 단계 (순서)

1. **스키마 설계**:  
   - `movement_test_attempts`: `id`, `user_id` (nullable for anonymous), `scoring_version` (e.g. `"1.0"`), `answers_snapshot` (JSONB, 선택), `completed_at`, `created_at`.  
   - `movement_test_results`: 기존 컬럼 유지, `attempt_id UUID REFERENCES movement_test_attempts(id)` 추가 (한 attempt당 한 result).  
   - 또는 attempts에 `main_type`, `sub_type`, `confidence`, `type_scores` 등 요약만 저장하고, 공유용은 기존 `movement_test_results`에 `share_id`만 두는 방식 선택.
2. **SQL 작성**: `create-movement-test-attempts-table.sql`에 테이블, RLS(deny-by-default: 본인만 select/insert), 인덱스(`user_id`, `completed_at DESC`).
3. **save-result API**: 쿼리에서 `getCurrentUserId(req)`로 user_id 확정(PR3와 연동). `movement_test_attempts` insert → `movement_test_results` insert (share_id, attempt_id). `scoring_version`은 상수 또는 `package.json`/설정에서 읽어 저장.
4. **get-latest-by-user**: `movement_test_attempts`에서 해당 user_id의 최신 1건 조회 후 연결된 result 반환.
5. **retest API**: 원본 attempt_id, 새 attempt_id로 두 결과를 조회해 compare 로직 적용. 응답 스펙은 기존과 호환.
6. **문서**: 스키마 ERD, API 요청/응답 예시, `scoring_version` 의미를 문서에 추가.

### Acceptance checklist

- [ ] `movement_test_attempts` 테이블이 RLS와 함께 생성되며, 서버에서만 쓰인다.
- [ ] save-result 호출 시 attempt와 result가 함께 생성되고, `scoring_version`이 저장된다.
- [ ] get-latest-by-user는 인증된 user_id 기준 최신 attempt/result를 반환한다.
- [ ] retest 비교가 attempt 기반으로 동작하며, 재테스트 비교 페이지가 정상 동작한다.
- [ ] 문서에 스키마 및 API 변경이 반영되어 있다.

---

## PR 3: API 인증/인가 표준화 (서버가 user_id 확정, userId 파라미터 제거, admin 권한 체크)

### 브랜치명
`feat/api-auth-standardization`

### 변경/추가/삭제 파일

| 구분 | 경로 |
|------|------|
| **추가** | `src/lib/auth/server.ts` (또는 `src/lib/api-auth.ts`) — `getCurrentUserId(req)`, `requireAuth(req)`, `requireAdmin(req)` 공통화 |
| **수정** | `src/app/api/upload/route.ts` — body `user_id` 제거, 서버에서 `getCurrentUserId(req)`만 사용 |
| **수정** | `src/app/api/survey/submit/route.ts` — body `userId` 제거, 서버에서 확정된 user_id만 사용 |
| **수정** | `src/app/api/send-report/route.ts` — body `userId` 제거, 서버 인증으로 user_id 확정 |
| **수정** | `src/app/api/payments/route.ts` — body `userId` 제거, 서버 인증으로 확정 |
| **수정** | `src/app/api/generate-photo-report/route.ts` — body `userId` 제거, 서버 인증으로 확정 |
| **수정** | `src/app/api/coach-comments/generate/route.ts` — body `userId` 제거, 서버 인증으로 확정 |
| **수정** | `src/app/api/coach-comments/user/[userId]/route.ts` — 경로에서 `userId` 제거. `GET /api/coach-comments/me` 등으로 변경하고, 서버에서 `getCurrentUserId`로 조회 |
| **수정** | `src/app/api/admin/report/route.ts` — 쿼리 파라미터 `userId`는 필터용으로만 허용, admin 권한 체크 추가 |
| **수정** | `src/app/api/admin/requests/route.ts` — admin 권한 체크 추가. Service role 사용 시 RLS bypass이므로 “호출자 = admin” 체크를 서버에서 수행 |
| **수정** | `src/app/api/admin/confirm/route.ts` — admin 권한 체크 추가 |
| **수정** | `src/app/api/push-notifications/subscribe/route.ts` — body `userId` 제거, `getCurrentUserId(req)`만 사용 |
| **수정** | 각 API에서 로컬 `getCurrentUserId` 복제 제거 후 `@/lib/auth/server` 등 공통 모듈에서 import |
| **문서** | `docs/API_AUTH.md` — 인증/인가 규칙, userId 파라미터 금지, admin 체크 방식 정리 |

### 작업 단계 (순서)

1. **공통 auth 모듈**: `getCurrentUserId(req)`: Cookie/Authorization에서 Supabase 세션 조회 후 `user.id` 반환. `requireAuth(req)`: 없으면 401. `requireAdmin(req)**: users.role = 'admin' 확인 후 아니면 403.
2. **admin 체크**: `requireAdmin(req)`를 admin 전용 라우트(requests, report, confirm) 상단에서 호출.
3. **userId 제거**: upload, survey/submit, send-report, payments, generate-photo-report, coach-comments/generate, push-notifications/subscribe에서 body/query의 userId 제거하고 서버에서만 user_id 사용.
4. **coach-comments/user/[userId]**: 새 경로 `GET /api/coach-comments/me` 추가, 기존 경로는 deprecated 또는 제거. 클라이언트를 `/me`로 이전.
5. **기존 getCurrentUserId 제거**: retest, get-latest-by-user, workout-routine/*, stripe/checkout 등에서 로컬 정의 제거하고 공통 모듈 사용.
6. **문서**: API_AUTH.md에 “모든 user 식별은 서버 세션에서만 수행”, “admin 전용 라우트는 requireAdmin 필수” 명시.

### Acceptance checklist

- [ ] 클라이언트에서 userId를 body/query로 보내는 엔드포인트가 제거되었고, 서버가 세션으로만 user_id를 확정한다.
- [ ] admin 라우트(requests, report, confirm)는 requireAdmin 통과 후에만 DB 접근한다.
- [ ] `/api/coach-comments/me`(또는 동일 의미 경로)로 “내 코치 코멘트” 조회 가능하다.
- [ ] Service role 키가 클라이언트 번들에 포함되지 않음(이미 서버 전용이면 유지). 문서에 “admin은 서버에서만” 명시.
- [ ] 문서 API_AUTH.md가 반영되어 있다.

---

## PR 4: Supabase RLS + Storage 정책 감사 (deny-by-default, 공유는 view/함수로 최소 필드만)

### 브랜치명
`feat/supabase-rls-storage-audit`

### 변경/추가/삭제 파일

| 구분 | 경로 |
|------|------|
| **추가/수정** | `supabase-setup/rls-policies-audit.sql` — 모든 public 테이블에 deny-by-default 정책 정리, 필요한 정책만 명시 |
| **추가** | `supabase-setup/movement-test-shared-view.sql` — 공유용 view 또는 RPC: share_id로 조회 시 노출할 컬럼만 선택 (예: main_type, sub_type, confidence, view_count, completed_at) |
| **수정** | `supabase-setup/create-movement-test-results-table.sql` — RLS 정책 수정: insert는 인증된 사용자 또는 익명(attempt 연동 시 정책 조정) |
| **수정** | Storage 정책 — `supabase-setup/CREATE_STORAGE_BUCKETS.md` 또는 별도 SQL: user-photos, assessments 등 deny-by-default, 필요한 경로만 INSERT/SELECT 허용 |
| **문서** | `docs/SUPABASE_RLS_STORAGE.md` — 테이블별 RLS 요약, 공유 view 사용법, Storage 정책 요약 |

### 작업 단계 (순서)

1. **테이블 목록 정리**: users, requests, movement_test_results, movement_test_attempts, subscriptions, notifications, workout_routines, coach_comments 등.
2. **RLS 원칙**: 각 테이블에 `ENABLE ROW LEVEL SECURITY` 유지. 기본적으로 정책이 없으면 DENY. 필요한 정책만 “본인만 SELECT/INSERT/UPDATE” 등으로 추가.
3. **movement_test_results 공유**: “Anyone can view shared results”를 제거하고, `movement_test_shared_view(share_id)` 같은 view 또는 RPC로 제한된 컬럼만 노출. API `get-result/[shareId]`는 이 view/RPC만 사용.
4. **Storage**: 기본 정책 제거 후, `auth.uid() = (storage.foldername())[1]` 같은 형태로 본인 버킷/경로만 허용. 공개 읽기가 필요한 경우 최소 경로만 허용.
5. **문서**: SUPABASE_RLS_STORAGE.md에 테이블·버킷별 정책 매트릭스와 공유 view 사용법을 적는다.

### Acceptance checklist

- [ ] 모든 관련 테이블이 RLS on이며, 기본 동작은 deny이다.
- [ ] 공유 결과 조회는 view 또는 RPC로만 이루어지며, 민감 필드(예: answers, user_id)는 노출되지 않는다.
- [ ] Storage는 deny-by-default이며, 필요한 범위만 허용 정책이 있다.
- [ ] 문서 SUPABASE_RLS_STORAGE.md가 반영되어 있다.

---

## PR 5: Stripe — webhook을 진실의 원천으로, 중복 처리(idempotency)

### 브랜치명
`feat/stripe-webhook-source-of-truth`

### 변경/추가/삭제 파일

| 구분 | 경로 |
|------|------|
| **추가** | `supabase-setup/create-stripe-events-table.sql` — `stripe_events` (id, event_id UNIQUE, type, payload JSONB, processed_at, created_at) |
| **수정** | `src/app/api/stripe/webhook/route.ts` — 수신 시 `stripe_events`에 event_id로 insert. 이미 존재하면 200 반환(이미 처리됨). 신규만 처리. 구독/유저 갱신은 webhook에서만 upsert. |
| **수정** | `src/app/api/stripe/verify-session/route.ts` — DB를 수정하지 않고, Stripe 세션 조회 + 기존 DB 조회(read-only)로 응답만 구성. 구독 생성/갱신은 webhook에만 의존한다고 문서화. |
| **문서** | `STRIPE_SETUP.md` — “진실의 원천은 webhook”, “verify-session은 read-only”, “중복 이벤트는 stripe_events로 방지” 추가 |

### 작업 단계 (순서)

1. **stripe_events 테이블**: `event_id` (Stripe event.id) UNIQUE, `type`, `payload` (JSONB), `processed_at`, `created_at`. 인덱스 on event_id.
2. **webhook 처리**:  
   - signature 검증 후 `event.id`로 `stripe_events`에 insert 시도.  
   - UNIQUE 위반 시 즉시 200 반환(idempotent).  
   - 성공 insert 시에만 checkout.session.completed / subscription.* / invoice.* 처리하고, users·subscriptions upsert.
3. **verify-session**: Stripe API로 session 조회, 필요 시 DB에서 subscription/plan 읽기만. insert/update 제거.
4. **문서**: STRIPE_SETUP.md에 위 규칙과 idempotency 설명 추가.

### Acceptance checklist

- [ ] 동일 Stripe event 재전송 시 webhook이 200을 반환하고, DB는 한 번만 갱신된다.
- [ ] verify-session은 DB에 쓰지 않고, 세션/구독 정보만 읽어서 응답한다.
- [ ] 구독/유저 플랜 갱신은 오직 webhook 경로에서만 수행된다.
- [ ] STRIPE_SETUP.md가 업데이트되어 있다.

---

## PR 6: Cron/Push — Asia/Seoul 기준 시간대 + 중복 발송 방지

### 브랜치명
`feat/cron-push-timezone-dedupe`

### 변경/추가/삭제 파일

| 구분 | 경로 |
|------|------|
| **추가** | `supabase-setup/notification-dedupe-log.sql` — 알림 발송 로그 테이블 (user_id, type, routine_id, routine_day_id, sent_at, UNIQUE 제약 등으로 동일 일자·대상 중복 방지) |
| **수정** | `src/lib/notifications/daily-workout-sender.ts` — 대상 조회 시 사용자 `daily_workout_time` + `daily_workout_timezone`(기본 Asia/Seoul)을 사용해 “현재 시각이 해당 사용자 기준 발송 시각인지” 판단. Cron은 매시 또는 15분 단위로 실행하고, 해당 시각대 사용자만 발송. |
| **수정** | `src/app/api/cron/daily-workout-notification/route.ts` — 호출 시점을 “Asia/Seoul 기준 오늘”로 해석. 발송 전 dedupe 로그 확인: 이미 (user_id, type, date) 조합으로 발송했으면 스킵. |
| **문서** | `docs/CRON_AND_PUSH.md` — Cron 스케줄(예: 0 0 * * * UTC + 한국 시간대 보정 또는 Vercel cron 표현), timezone 처리, dedupe 로직 설명 |

### 작업 단계 (순서)

1. **발송 로그 테이블**: 예) `notification_sent_log (id, user_id, notification_type, reference_id, reference_type, sent_at, created_at)`. (user_id, notification_type, reference_id, date(sent_at)) 유니크 또는 발송 전 select로 “오늘 이미 보냈는지” 확인.
2. **timezone**: `getDailyWorkoutNotificationTargets`에서 사용자별 `daily_workout_time` + `daily_workout_timezone`(기본 `Asia/Seoul`)으로 “지금이 그 사용자에게 보낼 시간인가?” 계산. Cron이 1시간마다 돌면, 현재 UTC를 Asia/Seoul로 변환한 뒤 그 “로컬 시간”에 해당하는 사용자만 조회.
3. **중복 방지**: 발송 직전에 “오늘 이미 daily_workout으로 이 user에게 보냈는지” 로그 테이블에서 확인. 있으면 스킵. 발송 성공 시 로그 insert.
4. **vercel.json**: cron 표현식이 의도한 시간대(예: 한국 09:00)와 맞는지 확인. 필요 시 `0 0 * * *`(자정 UTC)로 여러 번 돌리고, 로직에서 시간대 필터만 하거나, Vercel이 지원하면 timezone 지정.
5. **문서**: CRON_AND_PUSH.md에 스케줄, timezone, dedupe 규칙 정리.

### Acceptance checklist

- [ ] 일일 알림이 사용자 설정(Asia/Seoul 등) 기준 “해당 시각”에만 발송된다.
- [ ] 같은 사용자·같은 일자·같은 타입으로 중복 발송되지 않는다.
- [ ] Cron 라우트는 CRON_SECRET으로만 호출 가능하다.
- [ ] 문서 CRON_AND_PUSH.md가 반영되어 있다.

---

## PR 7: Service Worker — 캐시 제외 (auth/payment/api 등 민감 경로)

### 브랜치명
`feat/sw-cache-exclude-sensitive`

### 변경/추가/삭제 파일

| 구분 | 경로 |
|------|------|
| **수정** | `public/sw.js` — fetch 이벤트 리스너 추가 시, 요청 URL이 `/api/`, `/login`, `/(main)/login`, `/payments/`, `/auth/`, Stripe 관련 등이면 캐시하지 않고 네트워크만 사용. (현재 sw.js는 push/notificationclick만 있으면, “캐시 사용하지 않음”을 명시적으로 넣어 두어 향후 캐시 도입 시 적용.) |

### 작업 단계 (순서)

1. **제외 경로 목록 정의**: `/api/`, `/login`, `/(main)/login`, `/payments/`, `/auth/`, `/signup`, `stripe`, `webhook` 등.
2. **fetch 리스너**: `self.addEventListener('fetch', (event) => { ... })` 추가. `event.request.url`이 위 목록에 매칭되면 `event.respondWith(fetch(event.request))`만 하고 return. 그 외는 기존대로(또는 캐시 미사용 시 그냥 fetch만).
3. **캐시 미사용인 경우**: 현재처럼 캐시 로직이 없으면 “민감 경로는 절대 캐시하지 않음” 주석 + 향후 캐시 도입 시 적용할 블랙리스트만 추가해 두어도 됨.
4. **문서**: `docs/PWA_AND_SW.md` 또는 README에 “auth, payment, api 경로는 SW에서 캐시하지 않음” 명시.

### Acceptance checklist

- [ ] SW가 `/api/`, 로그인, 결제, auth 관련 요청을 캐시하지 않는다.
- [ ] 푸시/알림 클릭 동작은 기존과 동일하다.
- [ ] 문서에 SW 캐시 제외 정책이 반영되어 있다.

---

## PR 적용 순서 요약

| 순서 | 브랜치 | 의존성 |
|------|--------|--------|
| 1 | feat/movement-scoring-single-source | 없음 |
| 2 | feat/movement-test-attempts-schema-api | PR1 권장(스코어 버전 일치) |
| 3 | feat/api-auth-standardization | 없음 (가능하면 PR2와 순서 조정해 save-result에 인증 적용) |
| 4 | feat/supabase-rls-storage-audit | PR2 반영 후 attempts/results 정책 포함 |
| 5 | feat/stripe-webhook-source-of-truth | 없음 |
| 6 | feat/cron-push-timezone-dedupe | 없음 |
| 7 | feat/sw-cache-exclude-sensitive | 없음 |

---

## 제약 재확인

- **Service role 키**: `getServerSupabaseAdmin()` 및 `SUPABASE_SERVICE_ROLE_KEY`는 서버 전용. `src/lib/supabase/admin.ts`가 클라이언트 번들에 포함되지 않도록 (API route / server component에서만 import) 유지. 필요 시 `'use server'` 또는 동적 import로 한 번 더 점검.
- **각 PR**: 최소 1회 수동 또는 자동 검증 + 문서 업데이트 포함.
