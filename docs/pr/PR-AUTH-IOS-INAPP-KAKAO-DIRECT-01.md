# PR-AUTH-IOS-INAPP-KAKAO-DIRECT-01

## 요약

초기 로그인·가입 단계에서 **iOS 인앱 브라우저** 사용자에게 Safari 핸드오프 시트를 보이지 않음.

- **iOS 인앱 + 카카오 OAuth**: `startOAuthClient('kakao')` 직행 (인앱 유지).
- **iOS 인앱 + 이메일 로그인/가입**: `AuthCard` 기본 플로우 (`shouldUseInAppEmailAuthHandoff` → Android만 true).
- **Android 인앱**: OAuth·이메일 모두 기존 Chrome intent / handoff 유지.

## 변경 파일

| 파일 |
|------|
| `src/lib/auth/authExternalBrowserPolicy.ts` (신규) |
| `src/app/app/auth/AppAuthClient.tsx` |
| `src/app/signup/SignupClient.tsx` |
| `scripts/auth-ios-login-policy-smoke.ts` |
| `docs/pr/PR-AUTH-IOS-LOGIN-POLICY-01.md` |

## 비변경

- `startOAuthClient`, `buildAuthHandoffUrl`, `androidChromeIntent`, `authHandoffContract`
- PWA 설치 관련 컴포넌트
- 세션/readiness/결제/onboarding 코어

상세·롤백·Acceptance는 [`PR-AUTH-IOS-LOGIN-POLICY-01.md`](PR-AUTH-IOS-LOGIN-POLICY-01.md)와 동일하게 유지한다.
