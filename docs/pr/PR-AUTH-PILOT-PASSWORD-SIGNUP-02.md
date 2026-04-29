# PR-AUTH-PILOT-PASSWORD-SIGNUP-02 — 파일럿 즉시 이메일·비밀번호 가입

## 범위

- **포함:** `signInWithOtp` 제거, 이메일+비밀번호+닉네임+성별+나이 즉시 가입, `POST /api/auth/pilot-signup`, 가입 후 `signInWithPassword` + 기존 `replaceRouteAfterAuthSession(redirectTo)`.
- **제외 (PR1):** iOS/Google/Kakao 소셜 버튼 정책, Kakao·Google 로그인 동작 변경.

## 왜 OTP를 제거하는가

파일럿 단계에서 이메일 인증 링크는 브라우저/인앱 분리와 전환 손실을 유발할 수 있다. 서버에서 확인된 사용자(`email_confirm: true`)로 생성하고 즉시 로그인해 `/execution/start?...` 연속성을 유지한다.

## 흐름

1. `/signup?next=/execution/start?...` — `redirectTo`는 기존처럼 [`sanitizeAuthNextPath`](src/lib/auth/authHandoffContract.ts) 유지.
2. [`AuthCard`](src/components/auth/AuthCard.tsx) signup → `POST /api/auth/pilot-signup` → `signInWithPassword` → [`replaceRouteAfterAuthSession`](src/lib/readiness/navigateAfterAuth.ts)(`router`, `redirectTo`).
3. [`ExecutionStartClient`](src/app/execution/start/ExecutionStartClient.tsx): 기존과 동일 — pilot 있으면 redeem 후 `/onboarding`, 없으면 Stripe checkout 등.

## user_metadata

`nickname`, `gender`, `age`, `signup_source: "pilot_password_signup_v1"`. **profiles 테이블에 컬럼 추가 없음**, nickname/gender/age insert 안 함.

## public.users

[`20260224_core_authz_payments.sql`](supabase/migrations/20260224_core_authz_payments.sql)의 `on_auth_user_created` 트리거가 `public.users` 행을 만든다(가정). 본 PR은 DB 마이그레이션 없음.

## `/signup/complete`

레거시 이메일 링크·OTP 사용자 호환 전용. 새 가입 플로우에서는 호출하지 않는다. `CompleteClient` 로직은 본 PR에서 대규모 변경 없음.

## 보안

- Service role은 [`getServerSupabaseAdmin`](src/lib/supabase.ts) 서버 전용.
- password/원문 email/요청 body 전체 로깅 금지. API는 사용자 친화 메시지로 매핑.
- URL query에 자격 증명·metadata 넣지 않음.

## 검증

- `npm run test:auth-pilot-signup` — validation smoke
- `npm run test:pilot-auth`
- `npx tsc --noEmit` / `npm run lint` — 저장소 전역 이슈와 구분

## Abuse

[`/api/auth/pilot-signup`](src/app/api/auth/pilot-signup/route.ts)에 IP 기준 단순 윈도우 제한(예: 15분당 횟수). 서버리스 다인스턴스 한계는 TODO.
