# PR-WEB-PERF-01-PUBLIC-CRITICAL-ASSET-DIET

## assumptions
- This PR is strictly limited to root critical asset reduction in public funnel entry/route transitions.
- Supabase Kakao OAuth flow does not require Kakao JS SDK global script in root layout.
- No auth callback/PKCE contract changes are allowed in this PR.

## findings
- `src/app/layout.tsx` loaded 11 font families globally and attached all font variables at root `<html>`.
- Root `<head>` globally loaded Kakao JS SDK plus `window.Kakao.init(...)` using `NEXT_PUBLIC_KAKAO_JS_KEY`.
- `src/components/shared/PwaUpdateHandler.tsx` ran `navigator.serviceWorker.getRegistration('/')` immediately on mount.

## root cause
- Root layout was carrying non-essential global assets for every route including public funnel routes (`/`, `/intro/welcome`, `/movement-test/survey`, `/app/auth`, `/onboarding`).
- Service worker update detection executed on initial mount instead of idle/deferred timing.

## files changed
- `src/app/layout.tsx`
- `src/components/shared/PwaUpdateHandler.tsx`
- `scripts/public-critical-asset-diet-smoke.mjs`
- `package.json`

## what changed
- Reduced root font imports to `Geist`, `Noto_Sans_KR`, `Noto_Serif_KR` only.
- Removed global Kakao SDK script and `window.Kakao.init(...)` from root `<head>`.
- Deferred PWA update detection via `requestIdleCallback` (timeout 2500ms) or fallback `setTimeout` (1500ms).
- Added smoke script to enforce root critical asset diet constraints.

## font diet decision
- Removed candidates from layout import/class: `Geist_Mono`, `IBM_Plex_Sans_KR`, `Gowun_Dodum`, `Gothic_A1`, `Nanum_Gothic`, `Jua`, `Do_Hyeon`, `Nanum_Pen_Script`.
- Kept visual safety by preserving `--font-sans-noto` and `--font-serif-noto` and mapping removed variables to safe fallbacks at root inline CSS variables.
- This avoids touching `FontSwitcher.tsx` while preventing undefined-variable runtime styling regressions.

## Kakao SDK global removal decision
- Verified repository-wide usage for `window.Kakao`, `Kakao.init`, `kakao_js_sdk`, `NEXT_PUBLIC_KAKAO_JS_KEY` was layout-only before removal.
- Removed all such root-level script/init dependency from layout.
- Auth files were not modified.

## PWA update defer decision
- Preserved existing update behavior (waiting worker detect, `updatefound`, `controllerchange` one-time reload, toast).
- Moved setup trigger from immediate mount to idle/deferred scheduling to reduce initial contention on public routes.

## SSOT safety
- This PR does not modify analysis/readiness/session generation/public result/auth/payment contracts.
- This PR does not touch protected `/app` execution core domains.
- This PR is presentation/performance hardening only and aligns with public-first continuity boundaries.

## acceptance criteria
1. RootLayout에서 전역 Kakao SDK script 제거
2. layout 외 `window.Kakao`/`Kakao.init`/`kakao_js_sdk`/`NEXT_PUBLIC_KAKAO_JS_KEY` 의존 0
3. RootLayout font import family 수 감소
4. 제거한 font variable이 root class에 남지 않음
5. 제거한 font variable 참조가 repo에 남지 않거나 안전 fallback이 확인됨
6. `PwaUpdateHandler`가 mount 즉시 SW registration 조회하지 않고 idle/defer 후 실행
7. Kakao OAuth 관련 파일 수정 없음
8. PR02/PR04 대상 파일 수정 없음

## manual smoke checklist
- `/` first load
- `/intro/welcome`
- `/movement-test/survey`
- `/app/auth`
- `/onboarding`
- Kakao OAuth click path
- iOS Safari first load
- PWA existing install/update no obvious break

## non-goals
- PR02: readiness fetch 중복 제거 + route prefetch
- PR04: baseline result instant render
- Any auth callback/PKCE change
- Any payment/Stripe change
- Any session/public-result/readiness/camera contract change
