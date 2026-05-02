# PR-PILOT-AUTH-CONTINUITY-01 — Pilot 링크 연속성

## Root cause

1. **`useExecutionStartBridge`**: 결과 페이지에 `?pilot=`이 없으면 `getPilotCodeFromCurrentUrl()`만 사용해 `/execution/start`로 넘어가는 `next` 쿼리에 파일럿 코드가 빠짐.
2. **`ExecutionStartClient`**: `publicResultId`·`stage`가 유효할 때만 URL에서 파일럿을 저장해, bridge만 깨진 경우 URL의 파일럿이 로컬에 반영되지 않음.
3. **`extractBridgeQueryFromInternalPath`**: bridge 필드가 무효하면 객체 전체가 비워져 `next` 안의 유효한 `pilot`도 버려짐. 이번 PR에서는 파서를 바꾸지 않고, 호출부에서 저장된 파일럿 폴백(`getPilotCodeForCurrentFlow`)으로 보완.

## Changed files

- `src/lib/pilot/pilot-context.ts` — `getPilotCodeForCurrentFlow()` 추가·export (저장값은 `getPilotCodeFromSearchParams`로 재검증).
- `src/lib/public-results/useExecutionStartBridge.ts` — 파일럿 소스를 `getPilotCodeForCurrentFlow()`로 통일.
- `src/app/app/auth/AppAuthClient.tsx` — `bridgeExtras()` 파일럿 폴백.
- `src/app/signup/SignupClient.tsx` — 동일.
- `src/app/execution/start/ExecutionStartClient.tsx` — URL에서 파일럿 저장을 bridge와 분리; redeem 우선·Stripe 직전 파일럿 가드 공통 메시지.
- `src/app/(main)/page.tsx` — 이번 방문 `?pilot` + 로그인 + 온보딩 미완 시 기존 계정 모달.

## Manual acceptance checklist

1. iOS `/?pilot=xxx` → 설문 → 결과 → 가입/로그인 → 실행 시작: Stripe 미진입, `/api/pilot/redeem` 호출, 성공 시 `/onboarding`.
2. 동일 경로에서 이미 로그인: 로그인 생략 가능, redeem 발생, `/onboarding`.
3. `/` 파일럿 없음 + 비활성 사용자: 기존 결제 플로 유지.
4. `/?pilot=xxx` + 로그인·온보딩 미완 재방문: 기존 계정 모달, 이어하기 시 `/onboarding`, 새 테스트 시 로그아웃 후 진행.
5. `/execution/start?pilot=xxx` + 무효/누락 bridge: 파일럿 컨텍스트 저장 유지; bridge 없으면 `no_bridge` 가능하나 파일럿 손실 없음; Stripe로 가면 안 됨.
6. redeem 성공 전 `moveRePilotContext:v1` 유지; `redeemed` / `already_redeemed` 후 기존대로 `redeemPilotAccessClient`에서 clear.

## Non-goals

- Stripe API·`plan_status` 의미·세션 생성·스코어링·public result 렌더·PWA·푸시 수정 없음.
- auth 성공 경로를 `/onboarding`으로 하드코딩하지 않음 (성공 분기는 기존 redeem/onboarding 계약 유지).
- `SessionReadinessV1` 소유권·결제 소유권·`extractBridgeQueryFromInternalPath` 계약 변경 없음 (`redeemPilotAccessClient` clear 동작 변경 없음).

## Rollback

이 PR만 되돌리면 파일럿 코드가 결과 URL/`next`에서 다시 유실될 수 있음. 문제 시 해당 커밋 revert 후 파일럿 재테스트로 확인.
