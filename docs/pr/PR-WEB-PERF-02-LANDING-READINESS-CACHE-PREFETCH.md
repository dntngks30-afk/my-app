# PR-WEB-PERF-02 — Landing readiness cache + route prefetch

## assumptions

- `/` 랜딩에서 `fetchReadinessClient()`가 두 번 호출되면 메인 CTA 클릭 직후 체감 지연이 생길 수 있다.
- 동일 페이지 생명주기에서 readiness를 **한 번만** 요청하고 재사용해도 `/api/readiness` 계약과 동작 의미는 변하지 않는다.
- `router.prefetch`는 첫 페인트 이후 idle 시점에 스케줄하면 체감 전환에 도움이 된다.

## current issue

- `LandingReturnHomeCta`가 mount 시 readiness를 조회하고, `page.tsx`의 `handleStart`가 클릭 시 다시 조회했다.

## root cause

- readiness fetch 소유권이 분리되어 **동일 방문에서 중복 네트워크 왕복**이 가능했다.

## what changed

- `page.tsx`가 readiness **single-flight** owner (`readinessPromiseRef` + `loadReadinessOnce`).
- mount 시 1회 로드; `handleStart`는 동일 promise/결과 재사용.
- `canReturnHome`은 `readinessState === 'ready'`일 때만 `GO_APP_HOME` + `onboarding.is_complete`로 계산.
- `LandingReturnHomeCta`는 `canReturnHome` prop만 사용 (자체 fetch 제거).
- 메인 CTA: `startPendingRef` + `StitchLanding` `isStarting`으로 중복 클릭 방지 (`disabled` / `aria-busy`, 라벨 변경 없음).
- idle/defer로 `/intro/welcome`, `/movement-test/survey`, `/app/auth`만 `prefetch` (`/movement-test/baseline` · `refine-bridge` 제외).

## files changed

- `src/app/(main)/page.tsx`
- `src/components/landing/LandingReturnHomeCta.tsx`
- `src/components/stitch/landing/StitchLanding.tsx`
- `scripts/landing-readiness-cache-prefetch-smoke.mjs`
- `package.json`
- `docs/pr/PR-WEB-PERF-02-LANDING-READINESS-CACHE-PREFETCH.md`
- (검증 정합) `scripts/public-entry-readiness-guard-smoke.mjs` — return-home 게이트가 page로 이동한 것에 맞춤.

## readiness single-flight decision

- 전역 SWR/캐시 없이 **페이지 단위** ref로 in-flight 중복만 제거.

## return-home CTA prop-driven decision

- CTA는 readiness 타입을 몰라도 되게 `canReturnHome` boolean만 받는다.

## start CTA pending decision

- ref + state로 이중 클릭 시 `router.push` 중복 방지; 시각은 `disabled:opacity-75` 등 최소만.

## prefetch decision

- 필수 3경로만; baseline은 PR04 등과 번들 경쟁 가능해 제외.

## acceptance criteria

1. `/` mount 시 readiness는 page에서 single-flight.
2. `LandingReturnHomeCta`는 자체 fetch 없음.
3. return-home 노출: `GO_APP_HOME` + `onboarding.is_complete` (기존 의미, `GO_SESSION_CREATE`는 제외).
4. 메인 CTA는 캐시/in-flight promise 재사용.
5. fetch 실패/`null`이면 기존처럼 `runStartFlow()` 가능.
6. `GO_APP_HOME | GO_SESSION_CREATE` + 온보딩 완료 시 기존 계정 모달 유지.
7. 새 테스트 signOut 흐름 유지.
8. 위 3경로만 polite prefetch.
9. baseline prefetch 없음.
10–11. PR01B/PR04/readiness 계산·auth/scoring 미변경.
12. `StitchLanding` pending 시 `disabled`/`aria-busy`, 문구 유지.

## manual QA

- 로그아웃: return-home 없음 → CTA → 모달 없이 `/intro/welcome`.
- 로그인 + 온보딩 미완: return-home 없음 → CTA → intro.
- 로그인 + 완료 + `GO_APP_HOME`: return-home 노출 → CTA → 모달 → 계속하기 `/app/home`, 새 테스트 → signOut → intro.
- 체감: CTA 직후 두 번째 readiness 대기 감소, intro 이동 다소 빨라질 수 있음.

## non-goals

- `fetchReadinessClient` / `/api/readiness` / `session-readiness-owner.internal` 로직 변경.
- layout preload, 이미지 warmup, baseline instant render, `refine-bridge`/baseline prefetch.
