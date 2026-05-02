# PR-AUTH-IOS-LOGIN-POLICY-01 (+ PR-AUTH-IOS-INAPP-KAKAO-DIRECT-01 정합)

## 목표 (CURRENT_IMPLEMENTED — 코드 기준)

- **iOS**: Google 소셜 버튼 숨김. Kakao + 이메일(로그인·회원가입)만 노출.
- **iOS 인앱(KakaoTalk 등) — 카카오 OAuth**: `InAppAuthHandoffSheet`(“안전하게 이어서 시작하기”) 없이 **`startOAuthClient({ provider: 'kakao', … })`** 로 인앱에서 바로 진행 (`authExternalBrowserPolicy.shouldUseOAuthHandoffForProvider`).
- **iOS 인앱 — 이메일 로그인·회원가입**: 인앱 이메일 핸드오프 비활성화 → **`AuthCard` 기본 이메일/비밀번호 플로우** 직행 (`shouldUseInAppEmailAuthHandoff`는 Android만 true).
- **Android 인앱**: OAuth·이메일 모두 기존과 동일 — **handoff URL + Chrome intent** 유지.
- **iOS Safari 등 비인앱**: `inApp === false` → OAuth는 기존처럼 `startOAuthClient` 직행, 인앱 브리지 없음.
- **PWA 설치 단계 Safari 안내**: 로그인 정책과 분리 — **설치 UX에서만** 유지 (본 문서 범위 밖).

정책 모듈: `src/lib/auth/authExternalBrowserPolicy.ts`.

## Kakao OAuth 후 이메일 비어 결제 막힘 (기존 유지)

`/execution/start`에서 checkout 전 이메일 검사 → `/auth/collect-email` → `POST /api/auth/collect-email` 등 기존 폴백 — **변경 없음**.

## PR2 미변경 (LOCKED)

- `POST /api/auth/pilot-signup`, `AuthCard` 회원가입 필드·파일럿 이메일+비밀번호 가입 — **별도 PR 없이 로직 변경 금지**(표면 플래그만 조정).

## 비목표

- PWA 설치 UI 카피·동작 변경.
- `startOAuthClient` 내부·`window.open` 도입.
- Android Chrome intent 제거 또는 완화.
- `/app/home`, ResetMapV2, 세션/readiness/결제 소유권 변경.

## 롤백 노트

실제 단말에서 **카카오 인앱 OAuth 콜백이 불안정**하면 다음 순으로 좁히거나 되돌린다:

1. 직진 예외를 **KakaoTalk UA만**으로 제한 (`isKakaoInAppBrowser` 등).
2. 실패하는 provider/context에서만 시트 핸드오프 재도입.

## 수동 Acceptance

- Android KakaoTalk 인앱: Google/Kakao **handoff + Chrome intent** 유지.
- iOS Safari: Google 미노출, 카카오 OAuth 정상.
- iPhone Kakao 인앱 `/app/auth`: 카카오 버튼 → **시트 없음**, OAuth 진행.
- iPhone Kakao 인앱 `/signup`·이메일 로그인: 제출 시 **시트 없음**, 기존 API·Supabase 플로우.

## 검증

- `npm run test:auth-ios-login-policy` (스모크 — 정책 함수 포함)
- `npm run test:pilot-auth`, `npm run test:auth-pilot-signup`
- `npx tsc --noEmit`, `npm run lint` (기존 전역 오류와 신규 구분)
