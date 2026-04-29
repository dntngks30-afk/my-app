# PR-AUTH-IOS-LOGIN-POLICY-01

## 목표 (CURRENT_IMPLEMENTED — 배포 시 본 PR 코드 기준)

- **iOS**: Google 소셜 버튼 숨김. Kakao + 이메일(로그인·회원가입)만 노출.
- **iOS KakaoTalk 인앱**: Kakao 클릭 시 `InAppAuthHandoffSheet` 없이 `startOAuthClient('kakao')` 직접 실행.
- **iOS 기타 인앱 + Kakao**: 기존 handoff(sheet) 유지 — 코드 주석에 “KakaoTalk만 direct” 선택 이유 명시.
- **Android**: 인앱 handoff·Chrome intent 등 **기존과 동일** (변경 없음).
- **Kakao OAuth 후 `auth.user.email` 비어 결제 막힘**: `/execution/start`에서 checkout 전 이메일 검사 → `/auth/collect-email` → `POST /api/auth/collect-email`로 `public.users.email`(및 가능 시 auth) 갱신 → `/api/stripe/checkout`에서 `authUser.email` 없을 때 `users.email` 폴백.

## PR2 미변경 (LOCKED)

- `POST /api/auth/pilot-signup`, `AuthCard` 회원가입 필드·초기 파일럿 이메일+비밀번호 가입 — **본 PR에서 수정하지 않음**.

## 비목표

- PWA 설치 UI, public result / camera / deep scoring, session generator, `/app/home`·`SessionPanelV2`·`ExercisePlayerModal`.
- Supabase **신규** 마이그레이션.
- `startOAuthClient`의 Google `prompt=select_account` 제거.
- Android handoff 동작 변경.

## 수동 Acceptance

- Android KakaoTalk 인앱: Google/Kakao handoff 유지.
- iOS Safari·KakaoTalk: Google 미노출.
- KakaoTalk 인앱: Kakao 클릭 시 sheet 없이 OAuth.
- 이메일 없는 Kakao 계정: `/auth/collect-email` → 저장 후 `/execution/start` → checkout 또는 파일럿은 redeem 후 `/onboarding`.

## 검증

- `npm run test:auth-ios-login-policy` (스모크)
- `npm run test:pilot-auth`, `npm run test:auth-pilot-signup`
- `npx tsc --noEmit`, `npm run lint` (기존 전역 오류와 신규 구분)
