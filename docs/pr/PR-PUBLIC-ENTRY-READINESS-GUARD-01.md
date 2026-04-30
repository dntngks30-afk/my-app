# PR-PUBLIC-ENTRY-READINESS-GUARD-01

## assumptions
- 이 PR은 auth callback/PKCE 구조 변경이 아니라 public entry/readiness guard 회귀 차단에 집중한다.
- 기존 실행 코어(`/app/home`, session generator, onboarding 저장 로직)는 수정하지 않는다.

## findings
- `/`의 return-home CTA가 세션 존재만으로 `/app/home` 진입 CTA를 노출하고 있었다.
- readiness 우선순위에서 `hasActiveSession`이 `onboardingComplete`보다 먼저 평가되어, 온보딩 미완료 계정이 `/app/home`로 유도될 수 있었다.
- `/` 메인 CTA는 로그인된 기존 실행 계정과 새 테스트 시작 의도를 분기하지 않고 항상 테스트 시작으로 이동했다.

## files to change
- `src/components/landing/LandingReturnHomeCta.tsx`
- `src/lib/readiness/session-readiness-owner.internal.ts`
- `src/app/(main)/page.tsx`
- `src/components/landing/LandingExistingAccountModal.tsx` (new)
- `scripts/public-entry-readiness-guard-smoke.mjs` (new)
- `package.json`

## why this is safe relative to SSOT
- public-first continuity를 깨는 session-only 홈 복귀 CTA를 제거하고 readiness 기반으로 제한한다.
- onboarding 미완료 상태에서 active session이 있어도 `/app/home`로 보내지 않는 우선순위로 수정해 readiness law를 강화한다.
- 기존 계정 사용자는 실행 continuation으로, 새 테스트 의도 사용자는 signOut + public temp 정리 후 survey 진입으로 분리해 공존 상태 오염을 막는다.
- 보호 영역(`/app/home`, execution core, 결제/세션 생성 로직)은 직접 수정하지 않는다.

## acceptance test checklist
- [ ] 로그아웃 상태에서 `/` return-home CTA 미노출
- [ ] 로그인 + onboarding incomplete에서 `/` return-home CTA 미노출
- [ ] 로그인 + GO_SESSION_CREATE에서 `/` return-home CTA 미노출
- [ ] 로그인 + GO_APP_HOME + onboarding complete에서 `/` return-home CTA 노출
- [ ] onboarding incomplete + active_session_number 존재 시 readiness next_action = GO_ONBOARDING
- [ ] onboarding complete + active session 시 GO_APP_HOME
- [ ] `/` 메인 CTA 클릭 시 configured logged-in 계정이면 기존 계정 분기 모달 노출
- [ ] 모달 새 테스트 선택 시 signOut → temp clear → survey entry save → `/intro/welcome`
- [ ] iOS Safari 실기기에서 기존 로그인 세션 오염으로 결과 CTA가 즉시 `/onboarding`으로 가는 회귀가 재현되지 않음

## explicit non-goals
- `/app/home` UI/카피/탭 shell 변경
- session generator 규칙 변경
- onboarding DB 저장 필드/타이밍 변경
- Stripe/payment/auth callback 흐름 변경
- public deep/camera scoring 로직 변경
