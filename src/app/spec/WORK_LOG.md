# 프로젝트 작업 로그 (Work Log)

**작성 기준일**: 2026-02-10  
**프로젝트**: my-app (Next.js 기반 움직임 타입 테스트 / 포스처랩 SaaS)

---

## 1. 프로젝트 개요

- **이름**: my-app
- **버전**: 0.1.0
- **스택**: Next.js 16, React 19, TypeScript, Tailwind CSS 4, Supabase
- **주요 기능**: 동물 MBTI 스타일 움직임 타입 테스트, 설문/결과 PDF, 사진 분석, 구독/결제(Stripe), 운동 루틴, 코치 코멘트, 알림/푸시

---

## 2. 라우트 및 폴더 구조 변경

### 2.1 삭제된 라우트 (루트 app 기준)
- `src/app/login/page.tsx` → **(main) 그룹으로 이전**
- `src/app/my-report/page.tsx` → **(main) 그룹으로 이전**

### 2.2 (main) 그룹 라우트 (로그인 후 메인 서비스)
- `(main)/login/` — 로그인
- `(main)/my-report/` — 내 리포트
- `(main)/articles/`, `(main)/deep-analysis/`, `(main)/movement-check/`, `(main)/test/`, `(main)/types/` 등

### 2.3 관리자(admin)
- `admin/page.tsx` — 관리자 대시
- `admin/my-report/` — 관리자용 내 리포트
- `admin/report-uploader/` — 리포트 업로더

### 2.4 비활성/백업 (2026-02-09 기준)
- `app__DISABLED__20260209_085109/`, `login__DISABLED__20260209_085235/`, `my-report__DISABLED__20260209_085235/`
- `_backup_routefix_20260209_085109/`

---

## 3. 기능별 작업 내역

### 3.1 움직임 타입 테스트 (Movement Test)
- **라우트**: `/movement-test`, `/movement-test/survey`, `/movement-test/result`, `/movement-test/calibration`, `/movement-test/move`, `/movement-test/test`
- **수정 파일**: `MultipleChoice.tsx`, `scoring-logic.ts` (app·lib 양쪽), `result/page.tsx`, `shared/[shareId]/page.tsx`
- **기능**: 설문 진행, 점수/스코어링, 결과 페이지, **공유 URL** (`/movement-test/shared/[shareId]`, `shared/create`), **재테스트 비교** (`retest-comparison`, API `get-latest-by-user`, `retest`)
- **Feature 레이어**: `src/features/movement-test/` — `hooks/useDraftSync.ts`, `utils/scoring.ts`, `localAnswers.ts`, `session.ts`, `supabaseSync.ts`, `sync.ts`

### 3.2 Stripe 결제 / 구독
- **문서**: `STRIPE_SETUP.md`
- **API**: `/api/stripe/checkout`, `/api/stripe/webhook`, `/api/stripe/verify-session`, `/api/plans/get-by-tier`
- **페이지**: `payments/stripe-success/`, `payments/success/`, `payments/fail/`, `pricing/`
- **라이브러리**: `src/lib/stripe.ts`
- **DB**: `supabase-setup/create-subscription-tables.sql` (users 확장, plans, subscriptions 등)

### 3.3 알림 및 푸시
- **DB**: `supabase-setup/create-notification-tables.sql` (user_notification_preferences, daily_workout 등)
- **API**: `/api/push-notifications/subscribe`, `/api/cron/daily-workout-notification`
- **Vercel Cron**: `vercel.json` — `0 9 * * *` (매일 09:00)
- **클라이언트**: `PushNotificationPrompt.tsx`, `src/lib/push-notifications/client.ts`, `src/lib/notifications/daily-workout-sender.ts`

### 3.4 운동 루틴 (Workout Routine)
- **API**: `/api/workout-routine/create`, `/api/workout-routine/get`, `/api/workout-routine/complete-day`
- **라이브러리**: `src/lib/workout-routine/` (generator, ai-enhancer, exercise-mapping), `src/lib/prompts/workout-routine-prompt.ts`
- **DB**: `supabase-setup/create-workout-routine-tables.sql`
- **페이지**: `my-routine/`, `my-routine/coach-comments/`

### 3.5 코치 코멘트 (Coach Comments)
- **API**: `/api/coach-comments/[id]`, `generate`, `user/[userId]`
- **라이브러리**: `src/lib/coach-comments/`, `src/lib/prompts/coach-comment-prompt.ts`

### 3.6 내 리포트 / 사진 분석 / PDF
- **API**: `/api/my-report`, `/api/analyze-photo`, `/api/generate-photo-report`, `/api/send-report`, `/api/upload`
- **관리자**: `/api/admin/confirm`, `report`, `requests`
- **문서**: `SURVEY_PDF_SYSTEM.md`, `PHOTO_ANALYSIS_GUIDE.md`, `INSTALL_INSTRUCTIONS.md` 등

### 3.7 Movement Test 결과 저장/공유 API
- `/api/movement-test/save-result`, `get-result/[shareId]`, `get-latest-by-user`, `retest`
- **문서**: `MOVEMENT_TEST_SHARE_SETUP.md`

---

## 4. UI / 테마 / 컴포넌트

- **shadcn 스타일**: `components.json`, `src/components/ui/` (badge, button, card, checkbox, dialog, input, progress, select, separator, tabs)
- **테마**: `tailwind.config.ts`, `src/lib/themePresets.ts`, `src/lib/themes.ts`, `src/lib/utils.ts`
- **개발용**: `src/app/dev/ui-lab/`, `UIStyleSwitcher.tsx`, `ThemePresetSwitcher.tsx` (dev)
- **PWA/오프라인**: `public/sw.js`

---

## 5. Supabase / 데이터베이스

- **클라이언트/타입**: `src/lib/supabase.ts`, `src/lib/supabase-types.ts`, `src/lib/supabase/` (admin, browser, index)
- **설정 SQL**:  
  - `create-notification-tables.sql`  
  - `create-subscription-tables.sql`  
  - `create-workout-routine-tables.sql`  
  - `create-movement-test-results-table.sql`  
  - 기타: `create-users-table.sql`, 스토리지/RLS 등 (`CREATE_STORAGE_BUCKETS.md`, `RESTORE_GUIDE.md`)

---

## 6. API 엔드포인트 요약

| 구분 | 경로 |
|------|------|
| Admin | `/api/admin/confirm`, `report`, `requests` |
| 사진/리포트 | `/api/analyze-photo`, `generate-photo-report`, `my-report`, `send-report`, `upload` |
| 코치 코멘트 | `/api/coach-comments/[id]`, `generate`, `user/[userId]` |
| Cron | `/api/cron/daily-workout-notification` |
| Movement Test | `/api/movement-test/save-result`, `get-result/[shareId]`, `get-latest-by-user`, `retest` |
| 결제/플랜 | `/api/payments`, `/api/plans/get-by-tier`, `/api/stripe/checkout`, `webhook`, `verify-session` |
| 푸시 | `/api/push-notifications/subscribe` |
| 설문 | `/api/survey/submit` |
| 운동 루틴 | `/api/workout-routine/create`, `get`, `complete-day` |

---

## 7. 프로젝트 내 기존 문서 (참고)

- **기획/스펙**: `docs/MOVEMENT_TYPE_TEST_PRD.md`, `MOVEMENT_TYPE_TEST_SDD.md`, `MOVEMENT_TYPE_TEST_TASKS.md`  
- **설계**: `SYSTEM_DESIGN.md`, `SURVEY_PDF_SYSTEM.md`  
- **설정/가이드**: `STRIPE_SETUP.md`, `MOVEMENT_TEST_SHARE_SETUP.md`, `SEO_SETUP_GUIDE.md`, `PHOTO_ANALYSIS_GUIDE.md`, `INSTALL_INSTRUCTIONS.md`, `INSTALL_PDF_KOREAN.md`  
- **법적/마케팅**: `COMPLIANCE_REPORT.md`, `FINAL_COMPLIANCE_SUMMARY.md`, `SERVICE_COMPLIANCE_CHECK.md`, `MARKETING_GUIDELINES.md`, `TESTING_GUIDE.md`  
- **Supabase**: `supabase-setup/RESTORE_GUIDE.md`, `CREATE_STORAGE_BUCKETS.md`  
- **앱 스펙**: `src/app/spec/PRD.md`, `AGENT_BRIEF.md`, `ACCEPTANCE_TESTS.md`, `SPEC_survey_flow.md`

---

## 8. Git 상태 요약 (작업 시점 기준)

- **브랜치**: main (origin 대비 4커밋 앞선 상태)
- **삭제**: `src/app/login/page.tsx`, `src/app/my-report/page.tsx`
- **수정**: Movement Test 관련 컴포넌트·스코어링·결과·공유 페이지, `src/lib/supabase.ts` 등
- **신규/미추적**:  
  - 라우트: `(main)/login`, `(main)/my-report`, `admin/*`, API(cron, stripe, push-notifications, workout-routine, coach-comments 등), `movement-test/retest-comparison`, `shared/create`  
  - 컴포넌트: `PushNotificationPrompt`, `UIStyleSwitcher`, `src/components/ui/*`  
  - 설정: `components.json`, `tailwind.config.ts`, `vercel.json`  
  - Supabase/스키마: `supabase-setup/create-*-tables.sql`  
  - 기타: `STRIPE_SETUP.md`, `public/illustrations/`, `public/sw.js` 등

---

## 9. 다음 작업 시 참고사항

- 로그인/세션: `(main)/login` 및 Supabase Auth 연동 확인
- 결제: Stripe Webhook 시크릿·플랜 ID·가격 ID 설정 (`STRIPE_SETUP.md`)
- 공유/재테스트: Movement Test 결과 테이블 및 RLS 정책 적용 여부 확인
- 알림: Cron 스케줄(UTC 0 9 * * *) 및 타임존·푸시 구독 API 연동 확인