# PR-AUTH-UI-01 — MOVE RE Login/Signup Visual Transplant

## 목적

로그인·회원가입 화면의 presentation을 네오브루탈리즘에서 MOVE RE 공개 브랜드에 맞는 midnight / copper / glass 스타일로 이식했다. 라우팅·Supabase 호출·OAuth redirect·next handoff 로직은 유지했다.

## 변경 파일

- `src/app/app/auth/AppAuthClient.tsx` — `MoveReAuthScreen` 레이아웃, OTP 발송 후 상위 헤드라인 전환, OAuth는 `startOAuthClient` 호출 유지
- `src/app/signup/SignupClient.tsx` — 변경 없음(standalone signup은 `AuthCard`가 `MoveReAuthScreen` 포함)
- `src/components/auth/AuthCard.tsx` — 폼/UI 토큰, `signupLayout`, embedded 성공 시 패널만 표시
- `src/components/auth/AuthShell.tsx` — 글래스 패널 전용(chrome 재정의)
- `src/components/auth/MoveReAuthBackground.tsx` — 신규, 단색+방사형 글로우(CSS만)
- `src/components/auth/MoveReAuthScreen.tsx` — 신규, 헤더/서브복 본문 레이아웃
- `src/components/auth/AuthSocialButtons.tsx` — 신규, 소셜 버튼 UI만
- `src/lib/auth/startOAuthClient.ts` — 신규, 기존 `handleOAuth`와 동등한 로직 이전
- 본 문서

## Auth 계약 보존 내용

- `signInWithPassword`, `signInWithOtp`, dev `signUp` 호출 순서 및 옵션(`emailRedirectTo`, `signup/complete` next) 변경 없음
- `replaceRouteAfterAuthSession(router, redirectTo)` 그대로
- `/signup`, `/signup/complete`, `resolveRedirectTo` 링크의 `next` 쿼리 보존
- `errorParam === 'auth_failed'` 등 기존 에러 메시지 표시 유지

## OAuth 계약 보존 내용

- `startOAuthClient`에 기존 `AppAuthClient`의 canonical redirect, `redirectTo` URL `/auth/callback?next=...&provider=...`, `signInWithOAuth({ provider, options: { redirectTo } })` 그대로 이전
- `[AUTH-OAUTH]` 콘솔 이벤트명·필드 동일
- Google / Kakao provider 문자열 변경 없음

## Signup password UI와 계약

- 프로덕션: 이메일 OTP만(비밀번호 필드 없음) — 기존과 동일
- 개발: `NODE_ENV === 'development'`일 때만 비밀번호 필드·`signUp` + 기본 비밀번호 동작 유지

## 검증 결과

- `npm run build` — 성공(Next.js 16, webpack).
- `npm run lint`(next lint) — 이 저장소 환경에서 Invalid project directory 오류 발생; Next.js 16 eslint 통합 변경 시 로컬에서 재실행 권장.

## 남은 리스크

- Stitch ZIP 대비 미세한 여백·타이포는 추후 디자인 QA에서 조정 가능
- `page.tsx` Suspense fallback은 이번 PR 허용 목록에 없어 기본 베이지 유지(첫 페인트만 짧게 보일 수 있음)
